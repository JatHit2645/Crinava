"""Module docstring."""

import json
import os


class BallLogger:
    """Step 6: Handles local JSON persistence for match balls."""

    def __init__(self, match_id):
        """Docstring for __init__."""
        self.match_id = match_id
        self.filename = f"logs/match_{match_id}.json"

        # Ensure logs directory exists
        if not os.path.exists("logs"):
            os.makedirs("logs")

        # Initialize file if not exists
        if not os.path.exists(self.filename):
            with open(self.filename, "w") as f:
                json.dump([], f)

    def log_ball(self, ball_data):
        """Append a ball to the local JSON file."""
        try:
            with open(self.filename, "r+") as f:
                data = json.load(f)
                data.append(ball_data)
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
        except Exception as e:
            print(f"[Logger Error] Failed to log ball for {self.match_id}: {e}")
