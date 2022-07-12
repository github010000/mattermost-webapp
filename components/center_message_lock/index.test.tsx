// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {screen, SelectorMatcherOptions} from '@testing-library/react';

import {makeEmptyUsage} from 'utils/limits_test';
import {renderWithIntl} from 'tests/react_testing_utils';
import testConfigureStore from 'tests/test_store';
import {adminUsersState, endUsersState} from 'tests/constants/users';
import {emptyLimits} from 'tests/constants/cloud';
import {emptyPost} from 'tests/constants/posts';
import {emptyTeams} from 'tests/constants/teams';
import {cloudLicense} from 'tests/constants/license';

import CenterMessageLock from './';

jest.mock('mattermost-redux/actions/cloud', () => {
    const actual = jest.requireActual('mattermost-redux/actions/cloud');

    return {
        ...actual,
        getCloudLimits: jest.fn(),
    };
});

const initialState = {
    entities: {
        usage: makeEmptyUsage(),
        users: adminUsersState(),
        cloud: {
            limits: {...emptyLimits(), limitsLoaded: false},
        },
        general: {
            license: cloudLicense(),
        },
        teams: emptyTeams(),
        posts: {
            postsInChannel: {
                channelId: [
                    {
                        order: ['a','b','c'],
                        oldest: true,
                    }
                ],
            },
            posts: {
                'a': {...emptyPost(), id: 'a', created_at: 1},
                'b': {...emptyPost(), id: 'b', created_at: 2},
                'c': {...emptyPost(), id: 'c', created_at: 3},
            }
        }
    },
}

const exceededLimitsState = {
    ...initialState,
    entities: {
        ...initialState.entities,
        cloud: {
            ...initialState.entities.cloud,
            limits: {
                ...initialState.entities.cloud.limits,
                limitsLoaded: true,
                limits: {
                    messages: {
                        history: 2,
                    }
                },
            },
        },
        usage: {
            ...initialState.entities.usage,
            messages: {
                ...initialState.entities.usage.messages,
                history: 3,
            }
        },
    },
};

const endUserLimitExceeded = {
    ...exceededLimitsState,
    entities: {
        ...exceededLimitsState.entities,
        users: endUsersState(),
    },
}

describe('CenterMessageLock', () => {

    it('returns null if limits not loaded', () => {
        renderWithIntl(
            <Provider store={testConfigureStore(initialState)}>
                <CenterMessageLock channelId={'channelId'}/>
            </Provider>
        );
        expect(screen.queryByText('Notify Admin')).not.toBeInTheDocument();
        expect(screen.queryByText('Upgrade now')).not.toBeInTheDocument();
    });

    it('Admins have a call to upgrade', () => {
        renderWithIntl(
            <Provider store={testConfigureStore(exceededLimitsState)}>
                <CenterMessageLock channelId={'channelId'}/>
            </Provider>
        );
        screen.getByText('Upgrade now')
    });

    it('End users have a call to notify admin', () => {
        renderWithIntl(
            <Provider store={testConfigureStore(endUserLimitExceeded)}>
                <CenterMessageLock channelId={'channelId'}/>
            </Provider>
        );
        screen.getByText('Notify Admin')
    });

    it('Filtered messages over one year old display year', () => {
        renderWithIntl(
            <Provider store={testConfigureStore(exceededLimitsState)}>
                <CenterMessageLock channelId={'channelId'}/>
            </Provider>
        );
        screen.getByText('January 1, 1970', {exact: false})
    });

    it('New filtered messages do not show year', () => {
        const state = JSON.parse(JSON.stringify(exceededLimitsState))
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const expectedDate = firstOfMonth.toLocaleString('en', {month: 'long', day: 'numeric'})

        state.entities.posts.posts.a.create_at = Date.parse(firstOfMonth.toUTCString());
        renderWithIntl(
            <Provider store={testConfigureStore(state)}>
                <CenterMessageLock channelId={'channelId'}/>
            </Provider>
        );
        screen.getByText(expectedDate, {exact: false})
    });
});
