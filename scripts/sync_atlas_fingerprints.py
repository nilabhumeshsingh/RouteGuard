#!/usr/bin/env python3
"""
Syncs surveyed fingerprints with exact 3D coordinates to MongoDB Atlas.
"""
import json
import os
import dns.resolver
from pymongo import MongoClient

# Configure public DNS resolver to bypass local systemd-resolved SRV timeout
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '1.1.1.1']

MONGODB_URI = os.environ.get(
    "MONGODB_URI",
    "mongodb+srv://nilabhsingh2006_db_user:B6ufpPf5GMrleyb0@bss.yr6gwzt.mongodb.net/?retryWrites=true&w=majority"
)

def main():
    print("📡 Connecting to MongoDB Atlas...")
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    db = client["campussafe"]

    json_path = os.path.join(os.path.dirname(__file__), "../data/sample/mongo_docs.json")
    with open(json_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"📦 Loaded {len(docs)} aligned survey documents from {json_path}")

    # 1. Update locations collection
    loc_col = db["locations"]
    for doc in docs:
        loc = doc.get("location")
        loc_col.replace_one({"location": loc}, doc, upsert=True)
    print(f"✓ Upserted {len(docs)} documents into 'locations' collection.")

    # 2. Update fingerprints collection
    fp_col = db["fingerprints"]
    fp_col.delete_many({})
    fp_col.insert_many(docs)
    print(f"✓ Replaced {len(docs)} documents into 'fingerprints' collection.")

    # 3. Verify Room 219
    r219 = fp_col.find_one({"label": "Room 219"})
    if r219:
        print("🎯 Verified Room 219 in Atlas:")
        print(f"   Label: {r219.get('label')}")
        print(f"   Coordinates 3D: (X: {r219.get('x3d')}, Z: {r219.get('z3d')})")
        print(f"   Coordinates SVG: (X: {r219.get('xSvg')}, Y: {r219.get('ySvg')})")
        print(f"   APs Count: {len(r219.get('aps', []))}")
    else:
        print("⚠ Room 219 document not found in query.")

if __name__ == "__main__":
    main()
