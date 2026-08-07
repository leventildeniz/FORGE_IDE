import re

with open("forge-backend/src/main.rs", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(len(lines)):
    if "ws_route.with(warp::cors().allow_any_origin())" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""
            
    if "interval(Duration::from_secs(30))" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""
            
    if "client_session.sender.send(Message::text(json_response))" in lines[i]:
        lines[i] = "                            let _ = client_session.sender.send(Message::text(json_response));\n"
        
    if "Box::new(term_handle))" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""
            
    if "Box::new(handle))" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""

    if "knowledge::get_knowledge_base_path" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""
            
    if "tasks_clone.lock().await.insert" in lines[i]:
        lines[i] = re.sub(r'\.unwrap_or_default\(\);?', ';', lines[i])
        if i+1 < len(lines) and "return None;" in lines[i+1]:
            lines[i+1] = ""
        if not lines[i].strip().endswith(";"):
            lines[i] = lines[i].rstrip() + ";\n"

content = "".join(lines)

content = re.sub(r'let _ = client_session\.sender\.send\(Message::text\(serde_json::to_string\(&ok_resp\)\.unwrap\(\)\)\);?', 'ok_resp', content)
content = re.sub(r'let _ = client_session\.sender\.send\(Message::text\(serde_json::to_string\(&err_resp\)\.unwrap\(\)\)\);?', 'err_resp', content)
content = re.sub(r'let _ = client_session\.sender\.send\(Message::text\(serde_json::to_string\(&response\)\.unwrap\(\)\)\);?', 'response', content)

with open("forge-backend/src/main.rs", "w", encoding="utf-8") as f:
    f.write(content)
