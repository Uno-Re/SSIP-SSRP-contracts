#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  set -a  # Automatically export all variables
  . .env
  set +a
fi

# echo "ROLLUXTEST_URL=$ROLLUXTEST_URL"

export ROLLUXTEST_URL
export PROPTEST_MAX_SHRINK_ITERS=1000
# echo "PROPTEST_MAX_SHRINK_ITERS=$PROPTEST_MAX_SHRINK_ITERS"

# Run forge test with any additional arguments passed to this script
forge test "$@"
