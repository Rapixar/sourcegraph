package executor

import (
	"context"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/enterprise"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/codeintel"
	"github.com/sourcegraph/sourcegraph/internal/database/dbutil"
)

func Init(ctx context.Context, db dbutil.DB, enterpriseServices *enterprise.Services) error {
	handler, err := codeintel.NewCodeIntelUploadHandler(ctx, db, true)
	if err != nil {
		return err
	}

	proxyHandler, err := newInternalProxyHandler(handler)
	if err != nil {
		return err
	}

	enterpriseServices.NewExecutorProxyHandler = proxyHandler
	return nil
}
