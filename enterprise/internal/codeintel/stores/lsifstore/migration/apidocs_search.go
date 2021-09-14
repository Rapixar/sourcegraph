package migration

import (
	"context"
	"fmt"

	"github.com/hashicorp/go-multierror"
	"github.com/inconshreveable/log15"
	"github.com/keegancsmith/sqlf"
	"github.com/pkg/errors"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/dbstore"
	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/lsifstore"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/oobmigration"
)

// APIDocsSearchMigrationID is the primary key of the migration record handled by an instance of
// apiDocsSearchMigrator. This populates the new lsif_data_documentation_search table using data
// decoded from other tables. This is associated with the out-of-band migration record inserted in
// migrations/frontend/1528395874_oob_lsif_data_documentation_search.up.sql.
const APIDocsSearchMigrationID = 12

// NewAPIDocsSearchMigrator creates a new Migrator instance that reads records from the lsif_data_documentation_pages
// table, decodes the GOB payloads, and populates the new lsif_data_documentation_search table with
// the information needed to search API docs.
func NewAPIDocsSearchMigrator(store *lsifstore.Store, dbStore *dbstore.Store, repoStore *database.RepoStore, batchSize int) oobmigration.Migrator {
	return &apiDocsSearchMigrator{
		store:      store,
		dbStore:    dbStore,
		repoStore:  repoStore,
		serializer: lsifstore.NewSerializer(),
		batchSize:  batchSize,
	}
}

// Implements the oobmigration.Migrator interface.
type apiDocsSearchMigrator struct {
	store      *lsifstore.Store
	dbStore    *dbstore.Store
	repoStore  *database.RepoStore
	serializer *lsifstore.Serializer
	batchSize  int
}

// Progress returns a percentage (in the range range [0, 1]) of data records that need
// to be upgraded in the forward direction. A value of 1 means that no further action
// is required. A value < 1 denotes that a future invocation of the Up method could
// migrate additional data (excluding error conditions and prerequisite migrations).
func (m *apiDocsSearchMigrator) Progress(ctx context.Context) (float64, error) {
	progress, _, err := basestore.ScanFirstFloat(m.store.Query(ctx, sqlf.Sprintf(apiDocsSearchMigratorProgressQuery)))
	if err != nil {
		return 0, err
	}
	return progress, nil
}

const apiDocsSearchMigratorProgressQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration/apidocs_search.go:Progress
--
-- When migration has fully completed, we expect the same dump_ids to be indexed in both tables.
SELECT CASE c2.count WHEN 0 THEN 1 ELSE cast(c1.count as float) / cast(c2.count as float) END FROM
	(SELECT count(DISTINCT dump_id) FROM lsif_data_documentation_search) c1,
	(SELECT count(DISTINCT dump_id) FROM lsif_data_documentation_pages) c2
`

// Up runs a batch of the migration. This method is called repeatedly until the Progress
// method reports completion. Errors returned from this method will be associated with the
// migration record.
func (m *apiDocsSearchMigrator) Up(ctx context.Context) error {
	tx, err := m.store.Transact(ctx)
	if err != nil {
		return err
	}
	defer func() { err = tx.Done(err) }()

	dumpIDs, err := basestore.ScanInts(tx.Query(ctx, sqlf.Sprintf(apiDocsSearchMigratorUnprocessedDumpsQuery, m.batchSize)))
	if err != nil {
		return err
	}

	done := make(chan error, m.batchSize)
	for _, dumpID := range dumpIDs {
		dumpID := dumpID
		go func() {
			err := m.processDump(ctx, dumpID)
			done <- err
		}()
	}
	var errs error
	for range dumpIDs {
		err := <-done
		if err != nil {
			errs = multierror.Append(errs, err)
		}
	}
	return errs
}

const apiDocsSearchMigratorUnprocessedDumpsQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration/apidocs_search.go:Up
SELECT DISTINCT dump_id FROM lsif_data_documentation_pages WHERE NOT EXISTS (
	SELECT FROM lsif_data_documentation_search
	WHERE lsif_data_documentation_search.dump_id = lsif_data_documentation_pages.dump_id
) LIMIT %s
`

// processDump indexes all of the API documentation for the given dump ID by decoding the information
// in lsif_data_documentation_pages and inserting into the new lsif_data_documentation_search table.
func (m *apiDocsSearchMigrator) processDump(ctx context.Context, dumpID int) error {
	dumps, err := m.dbStore.GetDumpsByIDs(ctx, []int{dumpID})
	if err != nil {
		return errors.Wrap(err, "getDumpsByIDs")
	}
	if len(dumps) == 0 {
		return fmt.Errorf("could not get dump id=%v", dumpID) // Dump no longer exists, nothing we can do..
	}
	dump := dumps[0]

	repos, err := m.repoStore.GetByIDs(ctx, api.RepoID(dump.RepositoryID))
	if err != nil {
		return errors.Wrap(err, "RepoStore.GetByIDs")
	}
	if len(repos) == 0 {
		return fmt.Errorf("could not get repo id=%v name=%q", dump.RepositoryID, dump.RepositoryName) // Repository no longer exists? nothing we can do
	}
	repo := repos[0]

	tx, err := m.store.Transact(ctx)
	if err != nil {
		return err
	}
	defer func() { err = tx.Done(err) }()

	rows, err := m.store.Query(ctx, sqlf.Sprintf(apiDocsSearchMigratorPagesQuery, dumpID))
	if err != nil {
		return errors.Wrap(err, "Query")
	}
	defer rows.Close()
	indexed := 0
	for rows.Next() {
		indexed++
		var pageBytes []byte
		if err := rows.Scan(&pageBytes); err != nil {
			return errors.Wrap(err, "Scan")
		}

		page, err := m.serializer.UnmarshalDocumentationPageData(pageBytes)
		if err != nil {
			return errors.Wrap(err, "UnmarshalDocumentationPageData")
		}

		if err := tx.WriteDocumentationSearch(ctx, lsifstore.NewDocumentationSearchInfo(dump), repo, page); err != nil {
			return errors.Wrap(err, "WriteDocumentationSearch")
		}
	}
	log15.Info("Indexed API docs pages for search", "pages_indexed", indexed, "repo", dump.RepositoryName, "dump_id", dumpID)
	return nil
}

const apiDocsSearchMigratorPagesQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration/apidocs_search.go:Up
SELECT data FROM lsif_data_documentation_pages WHERE dump_id=%s
`

// Down runs a batch of the migration in reverse. This does not need to be implemented
// for migrations which are non-destructive. A non-destructive migration only adds data,
// and does not transform fields that were read by previous versions of Sourcegraph and
// therefore do not need to be undone prior to a downgrade.
func (m *apiDocsSearchMigrator) Down(ctx context.Context) error {
	return nil // our migration is non-destructive, it only populates a new table
}
