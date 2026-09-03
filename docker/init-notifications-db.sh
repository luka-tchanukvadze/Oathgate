#!/bin/sh
# Runs once, the first time the postgres volume is created
# The notifications service keeps its own database in the same server, because a
# second postgres for one small table is not worth 200MB on a 4GB Pi
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<SQL
  CREATE DATABASE oathgate_notifications;
SQL
