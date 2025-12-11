#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

python manage.py migrate contenttypes 0001_initial --fake
python manage.py migrate contenttypes
python manage.py migrate

python create_admin.py