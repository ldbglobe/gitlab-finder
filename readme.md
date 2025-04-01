# NodeJS Cli Gitlab Finder

Due to the Gitlab advanced search rate limiter, I was unable to use the CLI tools written by [Phillip Johnsen](https://github.com/phillipj/gitlab-search). So I wrote my own in NodeJS using the GitLab API NodeJS library [GitBeaker by Justin Dalrymple](https://github.com/jdalrymple/gitbeaker)

This project is quite straightforward with only to settings to fill in the .env file (a read only personnal auth token) and the string to search. Then you can start searching by running the ``search`` script

Notice: due to the really low rate limit (10 request per minute) you may wait for quite a long time. Based on my own experiment, about 700 seconds to search across 100 projects

## 1. Install

```bash
git clone git@github.com:ldbglobe/gitlab-finder.git \ 
    && cd gitlab-finder \ 
    && cp .env.sample .env \
```

## 2. Configure

Edit the ``.env`` to put your own personnal authtoken, gilab host instance and any default value you want to use for extra options

## 3. Install dependencies


```bash
npm install
```

## 4. Cli usage example

```bash
node search --help
node search -s test
node search -s test -p "*.js"
```