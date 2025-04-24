# C:\Users\AlexSol\Documents\zporta_academy_backend\seo\admin.py

from django.contrib import admin
from .models import SEOSetting, Redirect

@admin.register(SEOSetting)
class SEOSettingAdmin(admin.ModelAdmin):
    list_display = ['path', 'title', 'description']
    search_fields = ['path', 'title']

@admin.register(Redirect)
class RedirectAdmin(admin.ModelAdmin):
    list_display = ['old_path', 'new_path', 'permanent']
    search_fields = ['old_path', 'new_path']
