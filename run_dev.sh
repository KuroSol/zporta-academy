#!/bin/bash
cd $(dirname "$0")/zporta_academy_backend
source env/Scripts/activate
python manage.py runserver 8000 --settings=zporta.settings.local
