import json
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import MultiPartParser, FormParser
from .models import BulkImportJob
from .serializers import BulkImportJobSerializer
from .import_handler import BulkImportHandler
from .quiz_import_handler import QuizBulkImportHandler, QUIZ_ONLY_EXAMPLE
from .json_schema import BULK_IMPORT_SCHEMA, TOEIC_EXAMPLE, TOEFL_EXAMPLE, IELTS_EXAMPLE, CEFR_EXAMPLE


class BulkImportViewSet(viewsets.ModelViewSet):
    """Handle bulk import of courses, lessons, and quizzes"""
    serializer_class = BulkImportJobSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    authentication_classes = [SessionAuthentication]
    parser_classes = (MultiPartParser, FormParser)
    
    def get_queryset(self):
        # Users can only see their own imports
        return BulkImportJob.objects.filter(created_by=self.request.user)
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Upload and process JSON file for bulk import
        Expects multipart/form-data with 'file' and optionally 'dry_run' fields
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        dry_run = request.data.get('dry_run', False)
        
        try:
            # Parse JSON
            content = file.read().decode('utf-8')
            data = json.loads(content)
        except json.JSONDecodeError as e:
            return Response(
                {'error': f'Invalid JSON: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'File read error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create import job
        job = BulkImportJob.objects.create(
            created_by=request.user,
            status='processing'
        )
        
        # Process import
        handler = BulkImportHandler(request.user, job, dry_run=dry_run)
        try:
            handler.process(data)
            job.refresh_from_db()
        except Exception as e:
            job.status = 'failed'
            job.errors.append(f'Critical error: {str(e)}')
            job.save()
        
        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def schema(self, request):
        """Return the JSON schema for bulk imports"""
        return Response({
            'schema': BULK_IMPORT_SCHEMA,
            'examples': {
                'TOEIC': TOEIC_EXAMPLE,
                'TOEFL': TOEFL_EXAMPLE,
                'IELTS': IELTS_EXAMPLE,
                'CEFR': CEFR_EXAMPLE,
            }
        })
    
    @action(detail=False, methods=['get'])
    def example(self, request):
        """
        Get example JSON file for a specific exam type
        Query params: ?type=TOEIC|TOEFL|IELTS|CEFR
        """
        exam_type = request.query_params.get('type', 'TOEIC')
        
        examples = {
            'TOEIC': TOEIC_EXAMPLE,
            'TOEFL': TOEFL_EXAMPLE,
            'IELTS': IELTS_EXAMPLE,
            'CEFR': CEFR_EXAMPLE,
        }
        
        if exam_type not in examples:
            return Response(
                {'error': f'Unknown exam type: {exam_type}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response(examples[exam_type])
    
    @action(detail=False, methods=['post'], url_path='upload-quizzes')
    def upload_quizzes(self, request):
        """
        Upload ONLY quizzes with questions (no courses/lessons required)
        Expects multipart/form-data with 'file' and optionally 'dry_run' fields
        
        JSON format:
        {
          "quizzes": [
            {
              "title": "Quiz Title",
              "subject_name": "English",
              "questions": [
                {
                  "question_text": "Question?",
                  "question_type": "mcq",
                  "option1": "A",
                  "option2": "B",
                  "option3": "C",
                  "option4": "D",
                  "correct_option": 2
                }
              ]
            }
          ]
        }
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        dry_run = request.data.get('dry_run', 'false').lower() == 'true'
        
        try:
            # Parse JSON
            content = file.read().decode('utf-8')
            data = json.loads(content)
        except json.JSONDecodeError as e:
            return Response(
                {'error': f'Invalid JSON: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'File read error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process quiz-only import
        handler = QuizBulkImportHandler(request.user, dry_run=dry_run)
        try:
            result = handler.process(data)
            
            if result['success']:
                return Response({
                    'success': True,
                    'message': f'Successfully created {result["created_quizzes"]} quizzes with {result["created_questions"]} questions',
                    'created_quizzes': result['created_quizzes'],
                    'created_questions': result['created_questions'],
                    'warnings': result['warnings']
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'errors': result['errors'],
                    'warnings': result['warnings']
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response(
                {'error': f'Critical error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='quiz-example')
    def quiz_example(self, request):
        """Get example JSON for quiz-only import"""
        return Response(QUIZ_ONLY_EXAMPLE)
    
    @action(detail='pk', methods=['get'])
    def status(self, request, pk=None):
        """Get status of an import job"""
        job = self.get_object()
        serializer = self.get_serializer(job)
        return Response(serializer.data)
