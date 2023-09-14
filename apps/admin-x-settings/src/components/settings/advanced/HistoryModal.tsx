import Avatar from '../../../admin-x-ds/global/Avatar';
import Button from '../../../admin-x-ds/global/Button';
import Icon from '../../../admin-x-ds/global/Icon';
import InfiniteScrollListener from '../../../admin-x-ds/global/InfiniteScrollListener';
import List from '../../../admin-x-ds/global/List';
import ListItem from '../../../admin-x-ds/global/ListItem';
import Modal from '../../../admin-x-ds/global/modal/Modal';
import MultiSelect from '../../../admin-x-ds/global/form/MultiSelect';
import NiceModal, {useModal} from '@ebay/nice-modal-react';
import Popover from '../../../admin-x-ds/global/Popover';
import Toggle from '../../../admin-x-ds/global/form/Toggle';
import ToggleGroup from '../../../admin-x-ds/global/form/ToggleGroup';
import useRouting from '../../../hooks/useRouting';
import useStaffUsers from '../../../hooks/useStaffUsers';
import {Action, getActionTitle, getContextResource, getLinkTarget, isBulkAction, useBrowseActions} from '../../../api/actions';
import {RoutingModalProps} from '../../providers/RoutingProvider';
import {generateAvatarColor, getInitials} from '../../../utils/helpers';
import {useCallback, useState} from 'react';

const HistoryIcon: React.FC<{action: Action}> = ({action}) => {
    let name = 'pen';

    switch (action.event) {
    case 'added':
        name = 'add';
        break;
    case 'deleted':
        name = 'trash';
        break;
    }

    return <Icon name={name} size='xs' />;
};

const HistoryAvatar: React.FC<{action: Action}> = ({action}) => {
    return (
        <div className='relative shrink-0'>
            <Avatar
                bgColor={generateAvatarColor(action.actor?.name || action.actor?.slug || '')}
                image={action.actor?.image}
                label={getInitials(action.actor?.name || action.actor?.slug)}
                labelColor='white'
                size='md'
            />
            <div className='absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-grey-100 bg-white p-1 shadow-sm dark:border-grey-900 dark:bg-black'>
                <HistoryIcon action={action} />
            </div>
        </div>
    );
};

const HistoryFilterToggle: React.FC<{
    label: string;
    item: string;
    excludedItems: string[];
    toggleItem: (item: string, included: boolean) => void;
}> = ({label, item, excludedItems, toggleItem}) => {
    return <Toggle
        checked={!excludedItems.includes(item)}
        direction='rtl'
        label={label}
        labelClasses='text-sm'
        onChange={e => toggleItem(item, e.target.checked)}
    />;
};

const HistoryFilter: React.FC<{
    userId?: string;
    excludedEvents: string[];
    excludedResources: string[];
    toggleEventType: (event: string, included: boolean) => void;
    toggleResourceType: (resource: string, included: boolean) => void;
}> = ({userId, excludedEvents, excludedResources, toggleEventType, toggleResourceType}) => {
    const {updateRoute} = useRouting();
    const {users} = useStaffUsers();

    return (
        <div className='flex items-center gap-4'>
            <Popover position='right' trigger={<Button label='Filter' link />}>
                <div className='flex w-[220px] flex-col gap-8 p-5'>
                    <ToggleGroup>
                        <HistoryFilterToggle excludedItems={excludedEvents} item='added' label='Added' toggleItem={toggleEventType} />
                        <HistoryFilterToggle excludedItems={excludedEvents} item='edited' label='Edited' toggleItem={toggleEventType} />
                        <HistoryFilterToggle excludedItems={excludedEvents} item='deleted' label='Deleted' toggleItem={toggleEventType} />
                    </ToggleGroup>
                    <ToggleGroup>
                        <HistoryFilterToggle excludedItems={excludedResources} item='post' label='Posts' toggleItem={toggleResourceType} />
                        <HistoryFilterToggle excludedItems={excludedResources} item='page' label='Pages' toggleItem={toggleResourceType} />
                        <HistoryFilterToggle excludedItems={excludedResources} item='tag' label='Tags' toggleItem={toggleResourceType} />
                        <HistoryFilterToggle excludedItems={excludedResources} item='offer,product' label='Tiers & offers' toggleItem={toggleResourceType} />
                        <HistoryFilterToggle excludedItems={excludedResources} item='api_key,integration,setting,user,webhook' label='Settings & staff' toggleItem={toggleResourceType} />
                    </ToggleGroup>
                </div>
            </Popover>
            {userId ?
                <Button label='Clear search' link onClick={() => updateRoute('history/view')} /> :
                <div className='w-[200px]'>
                    <MultiSelect
                        options={users.map(user => ({label: user.name, value: user.id}))}
                        placeholder='Search staff'
                        values={[]}
                        onChange={([option]) => updateRoute(`history/view/${option.value}`)}
                    />
                </div>
            }
        </div>
    );
};

const HistoryActionDescription: React.FC<{action: Action}> = ({action}) => {
    const {updateRoute} = useRouting();
    const contextResource = getContextResource(action);

    if (contextResource) {
        const {group, key} = contextResource;

        return <>
            {group.slice(0, 1).toUpperCase()}{group.slice(1)}
            {group !== key && <span className='text-xs'> <code className='mb-1 bg-white text-grey-800 dark:bg-grey-900 dark:text-white'>({key})</code></span>}
        </>;
    } else if (action.resource?.title || action.resource?.name || action.context.primary_name) {
        const linkTarget = getLinkTarget(action);

        if (linkTarget) {
            return <a className='font-bold' href='#' onClick={(e) => {
                e.preventDefault();
                updateRoute(linkTarget);
            }}>{action.resource?.title || action.resource?.name}</a>;
        } else {
            return <>{action.resource?.title || action.resource?.name || action.context.primary_name}</>;
        }
    } else {
        return <span className='text-grey-500'>(unknown)</span>;
    }
};

const formatDateForFilter = (date: Date) => {
    const partsList = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(date);

    const parts = partsList.reduce<Record<string, string>>((result, {type, value}) => ({...result, [type]: value}), {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const PAGE_SIZE = 200;

const HistoryModal = NiceModal.create<RoutingModalProps>(({params}) => {
    const modal = useModal();
    const {updateRoute} = useRouting();

    const [excludedEvents, setExcludedEvents] = useState<string[]>([]);
    const [excludedResources, setExcludedResources] = useState<string[]>(['label']);

    const {data, fetchNextPage} = useBrowseActions({
        searchParams: {
            include: 'actor,resource',
            limit: PAGE_SIZE.toString(),
            filter: [
                excludedEvents.length && `event:-[${excludedEvents.join(',')}]`,
                excludedResources.length && `resource_type:-[${excludedResources.join(',')}]`,
                params?.user && `actor_id:${params.user}`
            ].filter(Boolean).join('+')
        },
        getNextPageParams: (lastPage, otherParams) => ({
            ...otherParams,
            filter: [otherParams.filter, lastPage.actions.length && `created_at:<'${formatDateForFilter(new Date(lastPage.actions[lastPage.actions.length - 1].created_at))}'`].join('+')
        }),
        keepPreviousData: true
    });

    const fetchNext = useCallback(() => {
        if (!data?.isEnd) {
            fetchNextPage();
        }
    }, [data?.isEnd, fetchNextPage]);

    const toggleValue = (setter: (fn: (values: string[]) => string[]) => void, value: string, included: boolean) => {
        setter(values => (included ? values.concat(value) : values.filter(current => current !== value)));
    };

    return (
        <Modal
            afterClose={() => {
                updateRoute('history');
            }}
            cancelLabel=''
            okLabel='Close'
            scrolling={true}
            size='md'
            stickyFooter={true}
            testId='history-modal'
            title='History'
            topRightContent={<HistoryFilter
                excludedEvents={excludedEvents}
                excludedResources={excludedResources}
                toggleEventType={(event, included) => toggleValue(setExcludedEvents, event, !included)}
                toggleResourceType={(resource, included) => toggleValue(setExcludedResources, resource, !included)}
                userId={params?.user}
            />}
            onOk={() => {
                modal.remove();
                updateRoute('history');
            }}
        >
            <div className='relative -mb-8 mt-6'>
                <List hint={data?.isEnd ? 'End of history log' : undefined}>
                    <InfiniteScrollListener offset={250} onTrigger={fetchNext} />
                    {data?.actions.map(action => !action.skip && <ListItem
                        avatar={<HistoryAvatar action={action} />}
                        detail={[
                            new Date(action.created_at).toLocaleDateString('default', {year: 'numeric', month: 'short', day: '2-digit'}),
                            new Date(action.created_at).toLocaleTimeString('default', {hour: '2-digit', minute: '2-digit', second: '2-digit'})
                        ].join(' | ')}
                        title={
                            <div className='text-sm'>
                                {getActionTitle(action)}{isBulkAction(action) ? '' : ': '}
                                {!isBulkAction(action) && <HistoryActionDescription action={action} />}
                                {action.count ? <> {action.count} times</> : null}
                                <span> &mdash; by {action.actor?.name || action.actor?.slug}</span>
                            </div>
                        }
                        separator
                    />)}
                </List>
            </div>
        </Modal>
    );
});

export default HistoryModal;
