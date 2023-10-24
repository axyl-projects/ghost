import ExitSettingsButton from './components/ExitSettingsButton';
import Heading from './admin-x-ds/global/Heading';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import Users from './components/settings/general/Users';
import useRouting from './hooks/useRouting';
import {ReactNode, useEffect} from 'react';
import {canAccessSettings, isEditorUser} from './api/users';
import {toast} from 'react-hot-toast';
import {topLevelBackdropClasses} from './admin-x-ds/global/modal/Modal';
import {useGlobalData} from './components/providers/GlobalDataProvider';

const Page: React.FC<{children: ReactNode}> = ({children}) => {
    return <>
        <div className='relative z-20 px-6 py-4 tablet:fixed'>
            <ExitSettingsButton />
        </div>

        <div className="mx-auto flex max-w-[1080px] flex-col px-[5vmin] py-[12vmin] tablet:flex-row tablet:items-start tablet:gap-x-10 tablet:py-[8vmin]" id="admin-x-settings-content">
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
            {loadingModal && <div className={`fixed inset-0 z-40 h-[100vh] w-[100vw] ${topLevelBackdropClasses}`} />}

            {/* Sidebar */}
            <div className="sticky top-[-47px] z-30 min-w-[260px] grow-0 md:top-[-52px] tablet:fixed tablet:top-[8vmin] tablet:basis-[260px]">
                <div className="relative w-full bg-white dark:bg-black">
                    <Sidebar />
                </div>
            </div>
            <div className="relative flex-auto pt-[10vmin] tablet:ml-[330px] tablet:pt-0">
                <Settings />
            </div>
        </Page>
    );
};

export default MainContent;
