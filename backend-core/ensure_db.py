#!/usr/bin/env python
"""
PostgreSQL에 uniquest DB가 없으면 생성합니다.
기존 볼륨으로 올린 경우 POSTGRES_DB가 적용되지 않아 DB가 없을 수 있습니다.
"""
import os
import sys

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def main():
    dbname = os.environ.get("POSTGRES_DB", "uniquest")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "postgres")
    host = os.environ.get("POSTGRES_HOST", "postgres")

    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (dbname,),
        )
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{dbname}"')
            print(f"Created database: {dbname}")
        else:
            print(f"Database already exists: {dbname}")
        cur.close()
        conn.close()
        return 0
    except Exception as e:
        print(f"ensure_db error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
