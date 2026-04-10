🔥 META PROMPT — BUILD LLM MEMORY SYSTEM (TS)                                                                                                                                          
                                                                                                                                                                                        
 ```                                                                                                                                                                                    
   Bạn là một senior systems architect. Viết toàn bộ package LLM Memory System bằng TypeScript, production-ready.                                                                       
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   📦 PACKAGE SPECIFICATION                                                                                                                                                             
                                                                                                                                                                                        
   Name: @mariozechner/pi-memory                                                                                                                                                        
   Type: TypeScript library (Node.js)                                                                                                                                                   
   Framework: Native TS (không dùng tr framework)                                                                                                                                       
   Target: AI Agents, LLM applications                                                                                                                                                  
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   🧱 ARCHITECTURE (7 COMPONENTS)                                                                                                                                                       
                                                                                                                                                                                        
   1. MEMORY STORE                                                                                                                                                                      
      - Interface: In-memory + pluggable adapters (Map, Redis, Postgres)                                                                                                                
      - Schema: id, type, content, metadata, timestamp, embedding?, tags[]                                                                                                              
      - Operations: create, read, update, delete, bulk                                                                                                                                  
                                                                                                                                                                                        
   2. CRUD ENGINE                                                                                                                                                                       
      - createMemory(data): Memory                                                                                                                                                      
      - updateMemory(id, data): Memory                                                                                                                                                  
      - deleteMemory(id): boolean                                                                                                                                                       
      - getMemory(id): Memory | null                                                                                                                                                    
      - listMemories(filter): Memory[]                                                                                                                                                  
                                                                                                                                                                                        
   3. RETRIEVAL ENGINE                                                                                                                                                                  
      - retrieve(query, options): Memory[]                                                                                                                                              
      - Hỗ trợ: keyword search, semantic search (nếu có embedding)                                                                                                                      
      - Filters: type, tags, date range, metadata                                                                                                                                       
                                                                                                                                                                                        
   4. RANKING SYSTEM                                                                                                                                                                    
      - Score memories theo: recency, relevance, frequency, weight                                                                                                                      
      - Algorithm: weighted scoring với configurable weights                                                                                                                            
      - Return top-k memories                                                                                                                                                           
                                                                                                                                                                                        
   5. CONTEXT BUILDER                                                                                                                                                                   
      - buildContext(query, options): string                                                                                                                                            
      - Ghép memories thành prompt context cho LLM                                                                                                                                      
      - Format: configurable template                                                                                                                                                   
                                                                                                                                                                                        
   6. VALIDATION LAYER (GUARDRAIL)                                                                                                                                                      
      - Schema validation (Zod)                                                                                                                                                         
      - Content validation: max length, sanitize                                                                                                                                        
      - Rate limiting: max memories per time window                                                                                                                                     
      - Deduplication: tránh trùng lặp                                                                                                                                                  
                                                                                                                                                                                        
   7. LLM INTERFACE (TOOL SCHEMA)                                                                                                                                                       
      - Tool definitions cho LLM gọi                                                                                                                                                    
      - Actions: create_memory, update_memory, delete_memory, retrieve_memories, search_memories                                                                                        
      - Each tool có: name, description, parameters, schema                                                                                                                             
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   ⚠️ CRITICAL CONSTRAINTS                                                                                                                                                              
                                                                                                                                                                                        
   1. LLM = PROPOSER, SYSTEM = CONTROLLER                                                                                                                                               
      - LLM chỉ đề xuất action (vd: "nên tạo memory này")                                                                                                                               
      - System validate + execute, không phải LLM                                                                                                                                       
      - Không để LLM tự ý modify memory                                                                                                                                                 
                                                                                                                                                                                        
   2. NO AGENT ILLUSION                                                                                                                                                                 
      - Đây là LIBRARY, không phải autonomous agent                                                                                                                                     
      - User/caller kiểm soát hoàn toàn                                                                                                                                                 
      - Không auto-execute LLM suggestions                                                                                                                                              
                                                                                                                                                                                        
   3. TYPE SAFETY                                                                                                                                                                       
      - 100% TypeScript, strict mode                                                                                                                                                    
      - Zod schemas cho tất cả inputs/outputs                                                                                                                                           
      - Không any types                                                                                                                                                                 
                                                                                                                                                                                        
   4. ERROR HANDLING                                                                                                                                                                    
      - Custom error class: MemoryError                                                                                                                                                 
      - Result<T> pattern (Ok/Err)                                                                                                                                                      
      - Graceful degradation (cache fallback)                                                                                                                                           
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   📋 API SIGNATURES                                                                                                                                                                    
                                                                                                                                                                                        
   interface MemoryStore {                                                                                                                                                              
     create(memory: MemoryInput): Memory;                                                                                                                                               
     get(id: string): Memory | null;                                                                                                                                                    
     update(id: string, data: Partial<MemoryInput>): Memory | null;                                                                                                                     
     delete(id: string): boolean;                                                                                                                                                       
     query(filter: MemoryFilter): Memory[];                                                                                                                                             
     bulkCreate(items: MemoryInput[]): Memory[];                                                                                                                                        
   }                                                                                                                                                                                    
                                                                                                                                                                                        
   interface MemoryEngine {                                                                                                                                                             
     createMemory(data: MemoryInput): Result<Memory, MemoryError>;                                                                                                                      
     updateMemory(id: string, data: Partial<MemoryInput>): Result<Memory, MemoryError>;                                                                                                 
     deleteMemory(id: string): Result<boolean, MemoryError>;                                                                                                                            
     getMemory(id: string): Result<Memory | null, MemoryError>;                                                                                                                         
     retrieve(query: string, options?: RetrievalOptions): Result<Memory[], MemoryError>;                                                                                                
     buildContext(query: string, options?: ContextOptions): Result<string, MemoryError>;                                                                                                
   }                                                                                                                                                                                    
                                                                                                                                                                                        
   interface LLMToolInterface {                                                                                                                                                         
     getTools(): Tool[];                                                                                                                                                                
     executeTool(name: string, params: Record<string, any>): Promise<Result<any, MemoryError>>;                                                                                         
   }                                                                                                                                                                                    
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   🎯 OUTPUT REQUIREMENTS                                                                                                                                                               
                                                                                                                                                                                        
   1. File structure:                                                                                                                                                                   
      src/                                                                                                                                                                              
      ├── index.ts          (exports chính)                                                                                                                                             
      ├── types.ts          (interfaces, types)                                                                                                                                         
      ├── schemas.ts        (Zod schemas)                                                                                                                                               
      ├── errors.ts         (custom errors)                                                                                                                                             
      ├── store/                                                                                                                                                                        
      │   ├── interface.ts                                                                                                                                                              
      │   └── memory-store.ts                                                                                                                                                           
      ├── engine/                                                                                                                                                                       
      │   ├── cruder.ts                                                                                                                                                                 
      │   ├── retrieval.ts                                                                                                                                                              
      │   ├── ranking.ts                                                                                                                                                                
      │   └── context-builder.ts                                                                                                                                                        
      ├── validation/                                                                                                                                                                   
      │   └── guardrail.ts                                                                                                                                                              
      ├── llm/                                                                                                                                                                          
      │   └── tools.ts                                                                                                                                                                  
      └── index.ts          (main exports)                                                                                                                                              
                                                                                                                                                                                        
   2. Test coverage: Basic unit tests cho core functions                                                                                                                                
                                                                                                                                                                                        
   3. Documentation: JSDoc comments cho tất cả exports                                                                                                                                  
                                                                                                                                                                                        
   4. No external deps ngoài: zod, typescript                                                                                                                                           
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   ✅ SUCCESS CRITERIA                                                                                                                                                                  
                                                                                                                                                                                        
   - Compiles without errors                                                                                                                                                            
   - Type-safe throughout                                                                                                                                                               
   - LLM chỉ propose, system control                                                                                                                                                    
   - Memory có: id, type, content, metadata, timestamp, tags                                                                                                                            
   - Retrieve supports: keyword, filter by type/tags                                                                                                                                    
   - Ranking: recency + relevance weighted                                                                                                                                              
   - Context builder: ghép memories thành string                                                                                                                                        
   - Tool schema cho LLM gọi được                                                                                                                                                       
                                                                                                                                                                                        
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                                                                                                
                                                                                                                                                                                        
   🚀 START WRITING NOW                                                                                                                                                                 
 ```                                                                                    
