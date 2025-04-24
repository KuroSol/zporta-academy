from django.contrib import admin

# Register your models here.
# learning/admin.py

from django.contrib import admin
from .models import LearningRecord

admin.site.register(LearningRecord)
