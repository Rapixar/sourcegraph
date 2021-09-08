import classNames from 'classnames'
import React, { useContext, useMemo } from 'react'

import { useObservable } from '@sourcegraph/shared/src/util/useObservable'

import { DiffStatStack } from '../../../components/diff/DiffStat'
import { ApplyPreviewStatsFields, DiffStatFields, Scalars } from '../../../graphql-operations'

import { queryApplyPreviewStats as _queryApplyPreviewStats } from './backend'
import { BatchChangePreviewContext } from './BatchChangePreviewContext'
import styles from './BatchChangePreviewStatsBar.module.scss'
import { ChangesetAddedIcon, ChangesetModifiedIcon, ChangesetRemovedIcon } from './icons'
import {
    PreviewActionArchive,
    PreviewActionClose,
    PreviewActionImport,
    PreviewActionPublish,
    PreviewActionReopen,
    PreviewActionUndraft,
    PreviewActionUpdate,
} from './list/PreviewActions'

const actionClassNames = classNames(
    styles.batchChangePreviewStatsBarStat,
    styles.batchChangePreviewStatsBarState,
    'd-flex flex-column justify-content-center align-items-center mx-2'
)

export interface BatchChangePreviewStatsBarProps {
    batchSpec: Scalars['ID']
    diffStat: DiffStatFields
    /** For testing purposes only. */
    queryApplyPreviewStats?: typeof _queryApplyPreviewStats
}

export const BatchChangePreviewStatsBar: React.FunctionComponent<BatchChangePreviewStatsBarProps> = ({
    batchSpec,
    diffStat,
    queryApplyPreviewStats = _queryApplyPreviewStats,
}) => {
    const { publicationStates } = useContext(BatchChangePreviewContext)

    /** We use this to recalculate the stats when the publication states are modified. */
    const stats = useObservable<ApplyPreviewStatsFields['stats']>(
        useMemo(() => queryApplyPreviewStats({ batchSpec, publicationStates }), [
            publicationStates,
            batchSpec,
            queryApplyPreviewStats,
        ])
    )

    if (!stats) {
        return null
    }

    return (
        <div className="d-flex flex-wrap mb-3 align-items-center">
            <h2 className="m-0 align-self-center">
                <span className="badge badge-info text-uppercase mb-0">Preview</span>
            </h2>
            <div className={classNames(styles.batchChangePreviewStatsBarDivider, 'd-none d-sm-block mx-3')} />
            <DiffStatStack className={styles.batchChangePreviewStatsBarDiff} {...diffStat} />
            <div className={classNames(styles.batchChangePreviewStatsBarHorizontalDivider, 'd-block d-sm-none my-3')} />
            <div className={classNames(styles.batchChangePreviewStatsBarDivider, 'mx-3 d-none d-sm-block d-md-none')} />
            <div
                className={classNames(
                    styles.batchChangePreviewStatsBarMetrics,
                    'flex-grow-1 d-flex justify-content-end'
                )}
            >
                <PreviewStatsAdded count={stats.added} />
                <PreviewStatsRemoved count={stats.removed} />
                <PreviewStatsModified count={stats.modified} />
            </div>
            <div className={classNames(styles.batchChangePreviewStatsBarHorizontalDivider, 'd-block d-md-none my-3')} />
            <div className={classNames(styles.batchChangePreviewStatsBarDivider, 'd-none d-md-block ml-3 mr-2')} />
            <div className={classNames(styles.batchChangePreviewStatsBarStates, 'd-flex justify-content-end')}>
                <PreviewActionReopen className={actionClassNames} label={`${stats.reopen} Reopen`} />
                <PreviewActionClose className={actionClassNames} label={`${stats.reopen} Close`} />
                <PreviewActionUpdate className={actionClassNames} label={`${stats.update} Update`} />
                <PreviewActionUndraft className={actionClassNames} label={`${stats.undraft} Undraft`} />
                <PreviewActionPublish
                    className={actionClassNames}
                    label={`${stats.publish + stats.publishDraft} Publish`}
                />
                <PreviewActionImport className={actionClassNames} label={`${stats.import} Import`} />
                <PreviewActionArchive className={actionClassNames} label={`${stats.archive} Archive`} />
            </div>
        </div>
    )
}

export const PreviewStatsAdded: React.FunctionComponent<{ count: number }> = ({ count }) => (
    <div className={classNames(styles.batchChangePreviewStatsBarStat, 'd-flex flex-column mr-2 text-nowrap')}>
        <div className="d-flex flex-column align-items-center justify-content-center">
            <span className={styles.previewStatsAddedLine}>&nbsp;</span>
            <span
                className={classNames(styles.previewStatsAddedIcon, 'd-flex justify-content-center align-items-center')}
            >
                <ChangesetAddedIcon />
            </span>
            <span className={styles.previewStatsAddedLine}>&nbsp;</span>
        </div>
        {count} Added
    </div>
)
export const PreviewStatsModified: React.FunctionComponent<{ count: number }> = ({ count }) => (
    <div className={classNames(styles.batchChangePreviewStatsBarStat, 'd-flex flex-column text-nowrap ml-2')}>
        <div className="d-flex flex-column align-items-center">
            <span className={styles.previewStatsModifiedLine}>&nbsp;</span>
            <span
                className={classNames(
                    styles.previewStatsModifiedIcon,
                    'd-flex justify-content-center align-items-center'
                )}
            >
                <ChangesetModifiedIcon />
            </span>
            <span className={styles.previewStatsModifiedLine}>&nbsp;</span>
        </div>
        {count} Modified
    </div>
)
export const PreviewStatsRemoved: React.FunctionComponent<{ count: number }> = ({ count }) => (
    <div className={classNames(styles.batchChangePreviewStatsBarStat, 'd-flex flex-column mx-2 text-nowrap')}>
        <div className="d-flex flex-column align-items-center">
            <span className={styles.previewStatsRemovedLine}>&nbsp;</span>
            <span
                className={classNames(
                    styles.previewStatsRemovedIcon,
                    'd-flex justify-content-center align-items-center'
                )}
            >
                <ChangesetRemovedIcon />
            </span>
            <span className={styles.previewStatsRemovedLine}>&nbsp;</span>
        </div>
        {count} Removed
    </div>
)
