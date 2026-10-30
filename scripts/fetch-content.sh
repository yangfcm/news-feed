#!/bin/sh
# Clone the content repo (source.json and data/) into the content folder before a build.
# Does nothing unless CONTENT_REPO is set, so local builds keep using the content folder as is.
#
#   CONTENT_REPO        owner/name on GitHub, e.g. yangfcm/news-feed-data
#   CONTENT_REPO_TOKEN  read-only token for it; only needed when the repo is private
#   CONTENT_DIR         where to put it, relative to the project root (default: content)
set -e

[ -n "$CONTENT_REPO" ] || exit 0

root=$(cd "$(dirname "$0")/.." && pwd)
target="$root/${CONTENT_DIR:-content}"
auth=${CONTENT_REPO_TOKEN:+x-access-token:$CONTENT_REPO_TOKEN@}

rm -rf "$target"
git clone --quiet --depth 1 "https://${auth}github.com/${CONTENT_REPO}.git" "$target"
echo "fetched $CONTENT_REPO into $target"
