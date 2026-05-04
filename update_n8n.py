import json

files = [
    "n8n/workflows/stratos-telegram-bot-v3-asesor.json",
    "n8n/workflows/stratos-telegram-bot-v4.json"
]

config_node = {
    "parameters": {
    "assignments": {
        "assignments": [
        {
            "id": "supabase-url",
            "name": "SUPABASE_URL",
            "value": "https://TU_PROYECTO.supabase.co",
            "type": "string"
        },
        {
            "id": "supabase-key",
            "name": "SUPABASE_SERVICE_ROLE_KEY",
            "value": "TU_SERVICE_ROLE_KEY",
            "type": "string"
        }
        ]
    },
    "options": {}
    },
    "type": "n8n-nodes-base.set",
    "typeVersion": 3.4,
    "position": [0, 0],
    "id": "global-config",
    "name": "Global Config"
}

for file_path in files:
    with open(file_path, "r") as f:
        data = json.load(f)

    # Check if "Global Config" already exists
    if any(n.get("name") == "Global Config" for n in data["nodes"]):
        continue

    # Find the trigger node
    trigger_node_name = None
    trigger_pos = [0, 0]
    for node in data["nodes"]:
        if "Telegram Trigger" in node.get("name", "") or node.get("type") == "n8n-nodes-base.telegramTrigger":
            trigger_node_name = node["name"]
            trigger_pos = node.get("position", [0, 0])
            break
            
    if not trigger_node_name:
        continue

    # Insert Global Config
    new_node = dict(config_node)
    new_node["position"] = [trigger_pos[0] + 150, trigger_pos[1]]
    data["nodes"].append(new_node)

    # Fix connections
    trigger_connections = data["connections"].get(trigger_node_name, {}).get("main", [[]])[0]
    
    # Trigger -> Global Config
    data["connections"][trigger_node_name] = {
        "main": [[{"node": "Global Config", "type": "main", "index": 0}]]
    }
    
    # Global Config -> whatever Trigger was pointing to
    data["connections"]["Global Config"] = {
        "main": [trigger_connections]
    }

    # Replace $env in all nodes
    for node in data["nodes"]:
        if "parameters" in node:
            params_str = json.dumps(node["parameters"])
            params_str = params_str.replace("{{ $env.SUPABASE_URL }}", "{{ $('Global Config').item.json.SUPABASE_URL }}")
            params_str = params_str.replace("{{ $env.SUPABASE_SERVICE_ROLE_KEY }}", "{{ $('Global Config').item.json.SUPABASE_SERVICE_ROLE_KEY }}")
            node["parameters"] = json.loads(params_str)

    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)
        
print("Updated successfully")
