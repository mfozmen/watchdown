"""Decides what the AI reviewer looks at: only what changed since its last review.

Called by .github/workflows/claude-review.yml before the review step. The reviewer's own
finished comment ends with a `REVIEWED-HEAD: <sha>` line, so the PR thread is its notebook.
This finds the newest such line, checks the sha is still an ancestor of the PR head (after a
rebase/force-push `git log A..B` would silently list the whole branch), and outputs:

  mode     incremental | full | unchanged
  base     the last reviewed sha (incremental/unchanged), else empty
  head     the PR head sha now under review
  commits  this PR's own new commits since base (merges and main's commits excluded)
  prev     path of a file holding the previous summary, so open findings get closed, not re-derived

Standard library only. Tests: .github/scripts/test_review_range.py (run by ci.yml).
"""
import json
import os
import re
import subprocess
import urllib.request
import uuid

REVIEWED_HEAD = re.compile(r'^REVIEWED-HEAD: ([0-9a-f]{7,40})$', re.MULTILINE)
# Only the review action's own finished comment counts: a human can't post as the Actions bot,
# and the completion signature excludes a review still in progress.
REVIEWER_LOGIN = 'github-actions[bot]'
FINISHED_SIGNATURE = '**Claude finished'


def last_review(comments):
    """(reviewed sha, body) of the newest finished review naming its head, else (None, None).

    `comments` is (author login, body) pairs, oldest first.
    """
    found = (None, None)
    for login, body in comments:
        body = body or ''
        if login != REVIEWER_LOGIN or not body.startswith(FINISHED_SIGNATURE):
            continue
        matches = REVIEWED_HEAD.findall(body)
        if matches:
            found = (matches[-1], body)
    return found


def choose_mode(base, head, is_ancestor):
    """full with no usable earlier review, unchanged when it already saw this head,
    incremental otherwise. `is_ancestor(base, head)` asks git."""
    if not base:
        return 'full'
    if head.startswith(base) or base.startswith(head):
        return 'unchanged'
    return 'incremental' if is_ancestor(base, head) else 'full'


def git(*args):
    return subprocess.run(['git', *args], capture_output=True, text=True)


def is_ancestor(base, head):
    return git('merge-base', '--is-ancestor', base, head).returncode == 0


def own_commits(base, head):
    """This PR's commits since `base`, oldest first, without merges or main's commits."""
    listed = git('log', '--no-merges', '--reverse', '--format=%h %s',
                 f'{base}..{head}', '^origin/main')
    return listed.stdout.strip()


def api(url, token):
    request = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_bodies(repo, number, token):
    """Every issue comment on the PR as (author login, body), following pagination."""
    bodies, page = [], 1
    while True:
        batch = api(f'https://api.github.com/repos/{repo}/issues/{number}/comments'
                    f'?per_page=100&page={page}', token)
        if not batch:
            return bodies
        bodies.extend(((comment.get('user') or {}).get('login', ''), comment.get('body') or '')
                      for comment in batch)
        page += 1


def write_outputs(path, values, delimiter=None):
    # Random delimiter: commit subjects flow into `commits`, and a fixed one could be closed
    # early by a subject equal to it, letting the rest overwrite `mode`.
    delimiter = delimiter or f'RANGE_{uuid.uuid4().hex}'
    with open(path, 'a', encoding='utf-8') as out:
        for key, value in values.items():
            if '\n' in value:
                out.write(f'{key}<<{delimiter}\n{value}\n{delimiter}\n')
            else:
                out.write(f'{key}={value}\n')


def main():
    repo, number, token = os.environ['GITHUB_REPOSITORY'], os.environ['PR_NUMBER'], os.environ['GH_TOKEN']
    head = api(f'https://api.github.com/repos/{repo}/pulls/{number}', token)['head']['sha']
    base, previous = last_review(fetch_bodies(repo, number, token))
    mode = choose_mode(base or '', head, is_ancestor)
    prev_path = os.path.join(os.environ.get('RUNNER_TEMP', '.'), 'previous-review.md')
    with open(prev_path, 'w', encoding='utf-8') as out:
        out.write(previous or '')
    commits = own_commits(base, head) if mode == 'incremental' else ''
    if mode == 'incremental' and not commits:
        mode = 'unchanged'  # only merges from main arrived: nothing of its own to review
    write_outputs(os.environ['GITHUB_OUTPUT'], {
        'mode': mode, 'base': (base or '') if mode != 'full' else '', 'head': head,
        'commits': commits, 'prev': prev_path})
    print(f'review range: mode={mode} base={base or "-"} head={head}')


if __name__ == '__main__':
    main()
