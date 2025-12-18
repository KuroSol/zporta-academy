from django.core.exceptions import ValidationError
from django.test import TestCase

from seo.sitemaps import TagSitemap
from .models import Tag


class TagValidationTests(TestCase):
	def test_reject_json_like_names(self):
		with self.assertRaises(ValidationError):
			Tag.objects.create(name='["song","words"]')

	def test_slug_regenerated_on_save(self):
		tag = Tag.objects.create(name='grammar')
		self.assertEqual(tag.slug, 'grammar')

		tag.name = 'grammar basics'
		tag.save()
		self.assertEqual(tag.slug, 'grammar-basics')

	def test_serializer_rejects_invalid(self):
		from .serializers import TagSerializer

		serializer = TagSerializer(data={'name': '{invalid}', 'description': ''})
		self.assertFalse(serializer.is_valid())
		self.assertIn('name', serializer.errors)


class TagSitemapTests(TestCase):
	def test_excludes_invalid_slugs(self):
		good = Tag.objects.create(name='clean-tag')
		bad = Tag.objects.create(name='another-clean')
		Tag.objects.filter(pk=bad.pk).update(slug='bad"slug')

		sitemap = TagSitemap()
		items = list(sitemap.items())
		self.assertIn(good, items)
		self.assertNotIn(bad, items)
