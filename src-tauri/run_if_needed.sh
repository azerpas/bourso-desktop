#!/bin/bash

# Define paths
DATA_DIR="/path/to/data_dir"
JOBS_FILE="$DATA_DIR/jobs.json"
PROGRAM="/path/to/my_program" 

# Check if jobs.json exists
if [ ! -f "$JOBS_FILE" ]; then
    echo "No jobs file found."
    exit 1
fi

# Get the current timestamp
NOW=$(date +%s)

# Function to convert a timestamp to YYYY-MM-DD
timestamp_to_date() {
    date -r "$1" +"%Y-%m-%d"
}

# Function to extract the week number from a timestamp
timestamp_to_week() {
    date -r "$1" +"%V"
}

# Function to extract the month from a timestamp
timestamp_to_month() {
    date -r "$1" +"%m"
}

# Function to extract the weekday (1=Monday, 7=Sunday)
timestamp_to_weekday() {
    date -r "$1" +"%u"
}

# Get current date info
NOW_DATE=$(timestamp_to_date "$NOW")
NOW_WEEK=$(timestamp_to_week "$NOW")
NOW_MONTH=$(timestamp_to_month "$NOW")
NOW_DAY_OF_WEEK=$(date +"%u")  # 1=Monday, 7=Sunday
NOW_DAY_OF_MONTH=$(date +"%d")

# Check if at least one job should run
SHOULD_RUN=false
while IFS= read -r line; do
    LAST_RUN=$(echo "$line" | jq -r '.last_run')
    SCHEDULE_TYPE=$(echo "$line" | jq -r '
        if (.schedule|type) == "string" then 
            .schedule 
        else 
            .schedule | keys[0] 
        end
    ')

    if [[ "$LAST_RUN" == "null" || -z "$LAST_RUN" ]]; then
        LAST_RUN=0  # If last_run is missing, assume it's never run
    fi

    LAST_RUN_DATE=$(timestamp_to_date "$LAST_RUN")

    if [[ "$SCHEDULE_TYPE" == "daily" ]]; then
        if [[ "$LAST_RUN_DATE" != "$NOW_DATE" ]]; then
            SHOULD_RUN=true
            break
        fi
    elif [[ "$SCHEDULE_TYPE" == "weekly" ]]; then
        LAST_RUN_WEEK=$(timestamp_to_week "$LAST_RUN")
        if [[ "$LAST_RUN_WEEK" != "$NOW_WEEK" ]]; then
            SHOULD_RUN=true
            break
        fi
    elif [[ "$SCHEDULE_TYPE" == "monthly" ]]; then
        LAST_RUN_MONTH=$(timestamp_to_month "$LAST_RUN")
        if [[ "$LAST_RUN_MONTH" != "$NOW_MONTH" ]]; then
            SHOULD_RUN=true
            break
        fi
    fi
done < <(jq -c '.[]' "$JOBS_FILE")  # Read each job as a JSON object

# If a job should run, execute the Rust program
if [[ "$SHOULD_RUN" == "true" ]]; then
    # Check if program is already running with the exact command
    if pgrep -fx "$PROGRAM trade orders" >/dev/null 2>&1; then
        echo "Error: Program is already running"
        exit 1
    fi

    echo "Running the program..."
    "$PROGRAM" trade orders
else
    echo "No jobs to run."
fi