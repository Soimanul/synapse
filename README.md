# 📝 Synapse - AI-Powered Note Taking App
A modern, intelligent note-taking application that transforms how you capture, organize, and interact with your knowledge. Built with React, Django, and AI integration for automatic content processing and intelligent insights.

## ✨ Features

### 🚀 Core Functionality
- **Rich Text Editor**: Advanced note editing with BlockNote editor
- **Document Upload**: Support for PDF, DOCX, and TXT files  
- **AI-Powered Processing**: Automatic content extraction and analysis
- **Smart Summaries**: AI-generated summaries of uploaded documents
- **Interactive Quizzes**: Auto-generated quizzes based on document content
- **Semantic Search**: Find notes and documents using natural language
- **Real-time Updates**: Live content synchronization across sessions

### 🎨 User Experience
- **Modern UI**: Clean, responsive design with dark/light mode support
- **Intuitive Navigation**: Easy-to-use interface with sticky headers
- **Visual Feedback**: Status indicators and smooth animations
- **Custom Styling**: Tailwind CSS with custom design system
- **Accessibility**: Keyboard navigation and screen reader support

### 🔧 Technical Features
- **Full-Stack Architecture**: React frontend + Django REST API backend
- **Authentication**: Secure JWT-based user authentication
- **Database**: PostgreSQL with optimized queries
- **Background Tasks**: Celery for async document processing
- **Caching**: Redis for improved performance
- **Containerization**: Docker support for easy deployment
- **Production Ready**: Nginx, Gunicorn, and proper security headers

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern UI library with hooks
- **Tailwind CSS** - Utility-first CSS framework
- **BlockNote Editor** - Rich text editing capabilities
- **JavaScript/ES6+** - Modern JavaScript features

### Backend
- **Django 5.2** - Python web framework
- **Django REST Framework** - API development
- **PostgreSQL** - Relational database
- **Redis** - Caching and task queuing
- **Celery** - Background task processing

### AI & Processing
- **Google Gemini API** - AI content generation
- **Sentence Transformers** - Text embeddings
- **Pinecone** - Vector database for semantic search
- **PyMuPDF** - PDF processing
- **python-docx** - Word document processing

### DevOps
- **Docker & Docker Compose** - Containerization
- **Nginx** - Web server and reverse proxy
- **Gunicorn** - WSGI HTTP server
- **Multi-stage builds** - Optimized container images

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/note-taking-app.git
cd note-taking-app

# Copy and configure environment
cp .env.template .env
# Edit .env with your API keys and settings

# Start the application (choose one)
./deploy.sh              # Production (Linux/Mac)
.\deploy.ps1             # Production (Windows)  
./deploy-dev.sh          # Development (Linux/Mac)
.\deploy-dev.ps1         # Development (Windows)
```

**📋 For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

### Access Points (for local dev)
- **Frontend**: http://localhost (production) or http://localhost:3000 (dev)
- **Admin Panel**: http://localhost/admin/
- **API Documentation**: http://localhost/api/

## 📚 Usage

### Getting Started Locally
1. **Sign Up**: Create your account at http://localhost
2. **Upload Documents**: Drag and drop PDF, DOCX, or TXT files
3. **Create Notes**: Use the rich text editor to write notes
4. **AI Processing**: Wait for automatic content analysis
5. **Review Summaries**: Check AI-generated document summaries
6. **Take Quizzes**: Test your knowledge with auto-generated questions
7. **Search Content**: Use semantic search to find information

### Document Processing Workflow
```
Upload Document → AI Content Extraction → Generate Summary → Create Quiz → Index for Search
```

### Key Features Usage
- **Rich Text Editing**: Bold, italic, lists, headers, and more
- **File Management**: Organize documents by categories
- **AI Summaries**: Get quick overviews of long documents
- **Quiz Generation**: Test comprehension with AI-created questions
- **Semantic Search**: Find content by meaning, not just keywords
- **Notes Linking**: Connect related notes and documents

## 🔧 Configuration

### Environment Variables
See `.env.template` for all available configuration options:

- **Django Settings**: SECRET_KEY, DEBUG, ALLOWED_HOSTS
- **Database**: PostgreSQL connection details
- **AI Services**: Google Gemini API, Pinecone credentials
- **Redis**: Cache and task queue configuration

### AI Service Setup
1. **Google Gemini**: Get API key from Google AI Studio
2. **Pinecone**: Create account and get API credentials
3. **Configure**: Add keys to `.env` file

## 📖 API Documentation

The application provides a RESTful API for all functionality:

### Authentication Endpoints
- `POST /api/token/` - Obtain JWT tokens
- `POST /api/token/refresh/` - Refresh access token
- `POST /api/register/` - User registration

### Core Endpoints
- `GET /api/documents/` - List documents
- `POST /api/documents/` - Upload document
- `GET /api/notes/` - List notes
- `POST /api/notes/` - Create note
- `POST /api/search/` - Semantic search
- `GET /api/health/` - Health check

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │    │   Django API     │    │  PostgreSQL DB  │
│  (Nginx:80)     │◄──►│  (Gunicorn:8000) │◄──►│   (Port 5432)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Celery Worker   │◄──►│   Redis Cache   │
                       │ (Background)     │    │  (Port 6379)    │
                       └──────────────────┘    └─────────────────┘
```

## 🛡️ Security

- **JWT Authentication** - Secure token-based auth
- **HTTPS Ready** - SSL/TLS configuration support  
- **CORS Protection** - Cross-origin request security
- **SQL Injection Prevention** - Django ORM protection
- **XSS Protection** - Content Security Policy headers
- **Environment Variables** - Secure credential management

## 🚀 Deployment

For detailed deployment instructions including development and production setups, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Quick Production Deployment guide
```bash
cp .env.template .env    # Configure environment
./deploy.sh             # Linux/Mac
.\deploy.ps1            # Windows
```

### Quick Development Setup  
```bash
./deploy-dev.sh         # Linux/Mac  
.\deploy-dev.ps1        # Windows
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Clone and setup
git clone https://github.com/yourusername/note-taking-app.git
cd note-taking-app

# Start development environment
docker-compose -f docker-compose-dev.yml up -d

# Run tests
docker-compose -f docker-compose-dev.yml exec web python manage.py test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **BlockNote** - Rich text editor framework
- **Django** - Web framework excellence
- **React** - UI library innovation
- **Google Gemini** - AI content generation
- **Pinecone** - Vector database technology
- **Tailwind CSS** - Utility-first styling
