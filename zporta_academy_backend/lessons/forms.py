# lessons/forms.py
from django import forms
from django_ckeditor_5.widgets import CKEditor5Widget
from .models import Lesson

class LessonAdminForm(forms.ModelForm):
    content = forms.CharField(
        widget=CKEditor5Widget(config_name='default'),
        help_text="You can paste <audio> tags here via the <> button."
    )

    class Meta:
        model = Lesson
        fields = '__all__'
