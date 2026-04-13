System prompt được build từ:                                                                                                                                                           
 1. customPrompt (SYSTEM.md)                                                                                                                                                            
 2. toolSnippets (từ tool definitions)                                                                                                                                                  
 3. promptGuidelines (từ tool definitions)                                                                                                                                              
 4. contextFiles (AGENTS.md, CLAUDE.md)                                                                                                                                                 
 5. skills (SKILL.md files)                                                                                                                                                             
 6. appendSystemPrompt (APPEND_SYSTEM.md)                                                                                                                                               
 7. date                                                                                                                                                                                
 8. cwd                                                                                                                                                                                 
         
Bây giờ để tôi tổng hợp lại tất cả các nguồn của system prompt:                                                                                                                        
                                                                                                                                                                                        
 1. customPrompt (SYSTEM.md) - Rất dài, chi tiết về workflow, rules, self-reflection, learning, memory, evolution, governance, v.v. NHƯNG KHÔNG HƯỚNG DẪN CÁCH GỌI TOOLS!               
 2. toolSnippets (từ tool definitions):                                                                                                                                                 
     - read: "Read file contents"                                                                                                                                                       
     - bash: "Execute bash commands (ls, grep, find, etc.)"                                                                                                                             
     - edit: "Make precise file edits with exact text replacement, including multiple disjoint edits in one call"                                                                       
     - write: "Create or overwrite files"                                                                                                                                               
     - grep: "Search file contents for patterns (respects .gitignore)"                                                                                                                  
     - find: "Find files by glob pattern (respects .gitignore)"                                                                                                                         
     - ls: "List directory contents"                                                                                                                                                    
     - todo_write: (không có)                                                                                                                                                           
     - Extension tools: (không có promptSnippet)                                                                                                                                        
 3. promptGuidelines (từ tool definitions):                                                                                                                                             
     - edit:                                                                                                                                                                            
           - "Use edit for precise changes (edits[].oldText must match exactly)"                                                                                                        
           - "When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls"                                 
           - "Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one    
 edit."                                                                                                                                                                                 
           - "Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions."                                                 
     - read: "Use read to examine files instead of cat or sed."                                                                                                                         
     - write: "Use write only for new files or complete rewrites."                                                                                                                      
     - bash, grep, find, ls: (không có promptGuidelines)                                                                                                                                
     - Extension tools: (không có promptGuidelines)                                                                                                                                     
 4. contextFiles (AGENTS.md, CLAUDE.md) - Rất dài, chi tiết về learning, memory, evolution, governance, v.v. NHƯNG KHÔNG HƯỚNG DẪN CÁCH GỌI TOOLS!                                      
 5. skills (SKILL.md files) - XML format, chỉ liệt kê skills, không nói cách gọi tools!                                                                                                 
 6. appendSystemPrompt (APPEND_SYSTEM.md) - Không tồn tại                                                                                                                               
 7. date & cwd - Chỉ là metadata                                                          

