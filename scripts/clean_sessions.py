
import json

def clean_sessions():
    file_path = 'public/sessions.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    seen_ids = set()
    cleaned_circuits = []
    
    for circuit in data['circuits']:
        # Standardize ID
        cid = circuit['id'].lower().replace('ã', 'a').replace('õ', 'o')
        if cid in seen_ids:
            print(f"Skipping duplicate: {circuit['id']}")
            continue
        
        circuit['id'] = cid
        seen_ids.add(cid)
        cleaned_circuits.append(circuit)
        
    data['circuits'] = cleaned_circuits
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print("Standardization complete.")

if __name__ == "__main__":
    clean_sessions()
