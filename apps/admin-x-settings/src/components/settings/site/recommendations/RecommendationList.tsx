import NoValueLabel from '../../../../admin-x-ds/global/NoValueLabel';
import React from 'react';
import RecommendationIcon from './RecommendationIcon';
import Table, {ShowMoreData} from '../../../../admin-x-ds/global/Table';
import TableCell from '../../../../admin-x-ds/global/TableCell';
// import TableHead from '../../../../admin-x-ds/global/TableHead';
import Button from '../../../../admin-x-ds/global/Button';
import EditRecommendationModal from './EditRecommendationModal';
import Link from '../../../../admin-x-ds/global/Link';
import NiceModal from '@ebay/nice-modal-react';
import TableRow from '../../../../admin-x-ds/global/TableRow';
import useRouting from '../../../../hooks/useRouting';
import useSettingGroup from '../../../../hooks/useSettingGroup';
import {PaginationData} from '../../../../hooks/usePagination';
import {Recommendation} from '../../../../api/recommendations';

interface RecommendationListProps {
    recommendations: Recommendation[],
    pagination?: PaginationData,
    showMore?: ShowMoreData,
    isLoading: boolean
}

const RecommendationItem: React.FC<{recommendation: Recommendation}> = ({recommendation}) => {
    const {route} = useRouting();

    // Navigate to the edit page, without changing the route
    // This helps to avoid fetching the recommendation
    const showDetails = () => {
        NiceModal.show(EditRecommendationModal, {
            pathName: route,
            animate: false,
            recommendation: recommendation
        });
    };

    const isGhostSite = recommendation.one_click_subscribe;
    const count = (isGhostSite ? recommendation.count?.subscribers : recommendation.count?.clicks) || 0;
    const newMembers = count === 1 ? 'new member' : 'new members';
    const clicks = count === 1 ? 'click' : 'clicks';

    return (
        <TableRow>
            <TableCell onClick={showDetails}>
                <div className='group flex items-center gap-3 hover:cursor-pointer'>
                    <div className={`flex grow flex-col`}>
                        <div className="mb-0.5 flex items-center gap-3">
                            <RecommendationIcon isGhostSite={isGhostSite} {...recommendation} />
                            <span className='line-clamp-1 font-medium'>{recommendation.title}</span>
                        </div>
                        {/* <span className='line-clamp-1 text-xs leading-snug text-grey-700'>{recommendation.url || 'No reason added'}</span> */}
                    </div>
                </div>
            </TableCell>
            <TableCell className='hidden w-8 align-middle md:!visible md:!table-cell' onClick={showDetails}>
                {/* {(count === 0) ? (<span className="text-grey-500">-</span>) : (<div className='flex grow flex-col'>
                    <span>{count}</span>
                    <span className='whitespace-nowrap text-xs text-grey-700'>{isGhostSite ? newMembers : clicks}</span>
                </div>)} */}
                {(count === 0) ? (<span className="text-grey-500">-</span>) : (<div className='-mt-px flex grow items-end gap-1'>
                    <span>{count}</span>
                    <span className='-mb-px whitespace-nowrap text-sm lowercase text-grey-700'>{isGhostSite ? newMembers : clicks}</span>
                </div>)}

            </TableCell>
        </TableRow>
    );
};

// TODO: Remove if we decide we don't need headers
// const tableHeader = (<><TableHead>Site</TableHead><TableHead>Conversions from you</TableHead></>);

const RecommendationList: React.FC<RecommendationListProps> = ({recommendations, pagination, showMore, isLoading}) => {
    const {
        siteData
    } = useSettingGroup();
    const recommendationsURL = `${siteData?.url.replace(/\/$/, '')}/#/portal/recommendations`;

    const {updateRoute} = useRouting();
    const openAddNewRecommendationModal = () => {
        updateRoute('recommendations/add');
    };

    if (isLoading || recommendations.length) {
        return <Table hint={<span>Shared with new members after signup, or anytime using <Link href={recommendationsURL} target='_blank'>this link</Link></span>} isLoading={isLoading} pagination={pagination} showMore={showMore} hintSeparator>
            {recommendations && recommendations.map(recommendation => <RecommendationItem key={recommendation.id} recommendation={recommendation} />)}
        </Table>;
    } else {
        return <NoValueLabel>
            <span className='mb-4 max-w-[40ch] text-center'>Get started by sharing any publication you think your audience will find valuable. Need inspiration? <Link href="https://ghost.org/explore" target='_blank'>Explore thousands of sites</Link>.</span>
            <Button color='grey' label='Add first recommendation' size='sm' onClick={() => {
                openAddNewRecommendationModal();
            }}></Button>
        </NoValueLabel>;
    }
};

export default RecommendationList;
