import ExitSettingsButton from './components/ExitSettingsButton';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import Users from './components/settings/general/Users';
import {Heading, topLevelBackdropClasses} from '@tryghost/admin-x-design-system';
import {ReactNode, useEffect} from 'react';
import {canAccessSettings, isEditorUser} from '@tryghost/admin-x-framework/api/users';
import {toast} from 'react-hot-toast';
import {useGlobalData} from './components/providers/GlobalDataProvider';
import {useRouting} from '@tryghost/admin-x-framework/routing';

const Page: React.FC<{children: ReactNode}> = ({children}) => {
    return <>
        <div className='sticky top-0 z-30 bg-white px-[5vmin] py-4 dark:bg-grey-975 tablet:fixed tablet:bg-transparent tablet:px-6 dark:tablet:bg-transparent xl:p-12'>
            <ExitSettingsButton />
        </div>
        <div className="w-full dark:bg-grey-975 tablet:fixed tablet:left-0 tablet:top-0 tablet:flex tablet:h-full" id="admin-x-settings-content">
            {children}
        </div>
    </>;
};

const MainContent: React.FC = () => {
    const {currentUser} = useGlobalData();
    const {route, updateRoute, loadingModal} = useRouting();

    useEffect(() => {
        // resets any toasts that may have been left open on initial load
        toast.remove();
    }, []);

    useEffect(() => {
        if (!canAccessSettings(currentUser) && route !== `staff/${currentUser.slug}`) {
            updateRoute(`staff/${currentUser.slug}`);
        }
    }, [currentUser, route, updateRoute]);

    if (!canAccessSettings(currentUser)) {
        return null;
    }

    if (isEditorUser(currentUser)) {
        return (
            <Page>
                <div className='w-full'>
                    <Heading className='mb-10'>Settings</Heading>
                    <Users highlight={false} keywords={[]} />
                </div>
            </Page>
        );
    }

    return (
        <Page>
            {loadingModal && <div className={`fixed inset-0 z-40 h-[calc(100vh-55px)] w-[100vw] tablet:h-[100vh] ${topLevelBackdropClasses}`} />}
            <div className="scrollbar-hidden fixed inset-x-0 top-[52px] z-[999] flex-1 basis-[320px] bg-white px-8 pb-8 dark:bg-grey-975 tablet:relative tablet:inset-x-auto tablet:top-auto tablet:h-full tablet:overflow-y-scroll tablet:bg-grey-50 tablet:pb-0 dark:tablet:bg-black" id="admin-x-settings-sidebar-scroller">
                <div className="relative w-full">
                    <Sidebar />
                </div>
            </div>
            <div className="relative h-full flex-1 overflow-y-scroll pt-11 tablet:basis-[800px]" id="admin-x-settings-scroller">
                <Settings />
            </div>
        </Page>
    );
};

export default MainContent;
