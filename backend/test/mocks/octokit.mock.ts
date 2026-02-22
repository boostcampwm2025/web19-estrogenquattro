export class Octokit {
  rest = {
    users: {
      getByUsername: () =>
        Promise.resolve({
          data: {
            login: 'mock-user',
            id: 1,
            avatar_url: 'https://example.com/avatar.png',
            html_url: 'https://github.com/mock-user',
            followers: 0,
            following: 0,
            name: 'Mock User',
            bio: 'mock',
          },
        }),
      follow: () => Promise.resolve({ status: 204 }),
      unfollow: () => Promise.resolve({ status: 204 }),
    },
  };

  request(route: string): Promise<{ status: number }> {
    if (route.includes('/user/following/')) {
      return Promise.resolve({ status: 204 });
    }

    return Promise.resolve({ status: 200 });
  }
}
