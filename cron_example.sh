#!/bin/bash
# Example cron job for daily data collection
# 
# To use:
# 1. Edit paths below
# 2. Make executable: chmod +x cron_example.sh
# 3. Add to crontab: crontab -e
#    0 18 * * * /Users/Tim/Backzest/cron_example.sh

# Set paths
PROJECT_DIR="/Users/Tim/Backzest"
PYTHON_PATH="/usr/local/bin/python3"  # Update to your Python path
LOG_DIR="$PROJECT_DIR/logs"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Set log file with timestamp
LOG_FILE="$LOG_DIR/cron_$(date +\%Y\%m\%d).log"

# Change to project directory
cd "$PROJECT_DIR" || exit 1

# Run incremental data collection
echo "=== Data collection started at $(date) ===" >> "$LOG_FILE" 2>&1
"$PYTHON_PATH" scripts/collect_all.py --incremental >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "=== Data collection completed successfully at $(date) ===" >> "$LOG_FILE" 2>&1
else
    echo "=== Data collection failed with exit code $EXIT_CODE at $(date) ===" >> "$LOG_FILE" 2>&1
    # Optional: Send alert email
    # echo "Data collection failed. Check $LOG_FILE" | mail -s "Data Collection Alert" your@email.com
fi

# Keep only last 30 days of logs
find "$LOG_DIR" -name "cron_*.log" -mtime +30 -delete

exit $EXIT_CODE

