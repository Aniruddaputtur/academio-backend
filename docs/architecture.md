# Academio System Architecture & Future RAG Integration Specification

## 1. Modular Architecture
The Academio backend follows a clean layered design:

```
[ HTTP Clients (Web / Mobile / Third-Party) ]
                    │
                    ▼
           [ Helmet & CORS Security ]
                    │
                    ▼
          [ Rate Limiting & Auth ]
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
[/api/auth]   [/api/academic]  [/api/ai]
     │              │              │
[AuthService] [AcademicService][AIService + ContextBuilder]
     │              │              │
     └──────────────┼──────────────┘
                    ▼
          [ Prisma Client (ORM) ]
                    │
                    ▼
         [ SQLite (dev.db) ]
```

## 2. Future Document Search & RAG Integration Roadmap
To support future retrieval across college syllabi, exam circulars, and course materials:
1. **Document Storage:** Store PDFs and syllabi under an S3/Blob storage or local secured upload directory with file hash validation.
2. **Chunking & Embeddings:** Use OpenAI `text-embedding-3-small` to generate vector representations of chunked policy and syllabus text.
3. **Vector Database / SQLite VSS:** Use `sqlite-vss` or a dedicated vector store (such as Pinecone or Qdrant) linked via `Subject` and `College` IDs.
4. **Access Control Filtering:** Ensure students only retrieve chunks matching their enrolled college and enrolled subjects.

