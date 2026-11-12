"""Prints one value from Renotes' library, read-only: query.py <sql>.
CI uses it to check what the smoke test typed was saved."""
import os
import sqlite3
import sys

library = os.path.expandvars(r"%APPDATA%\Renotes\library.sqlite")
db = sqlite3.connect(f"file:{library}?mode=ro", uri=True)
row = db.execute(sys.argv[1]).fetchone()
print(row[0] if row else "")
