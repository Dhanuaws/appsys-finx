\
import argparse, glob, json, os
from pathlib import Path

def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Folder containing *.describe.json (describe-table exports)")
    ap.add_argument("--out", dest="out", required=True, help="Output tfvars JSON path")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.inp, "*.describe.json")))
    if not files:
        raise SystemExit(f"No *.describe.json found under: {args.inp}")

    tables = []
    for fpath in files:
        d = load_json(fpath)
        t = d["Table"]

        name = t["TableName"]
        ks = t.get("KeySchema", [])
        hash_key = next(k["AttributeName"] for k in ks if k["KeyType"] == "HASH")
        range_key = next((k["AttributeName"] for k in ks if k["KeyType"] == "RANGE"), None)

        attrs = [{"name": a["AttributeName"], "type": a["AttributeType"]} for a in t.get("AttributeDefinitions", [])]

        billing = (t.get("BillingModeSummary") or {}).get("BillingMode", "PAY_PER_REQUEST")

        obj = {
            "name": name,
            "billing_mode": billing,
            "hash_key": hash_key,
            "attributes": attrs,
            "sse_enabled": True
        }
        if range_key:
            obj["range_key"] = range_key

        gsis = []
        for g in t.get("GlobalSecondaryIndexes") or []:
            gks = g.get("KeySchema", []) or []
            gh = next(k["AttributeName"] for k in gks if k["KeyType"] == "HASH")
            gr = next((k["AttributeName"] for k in gks if k["KeyType"] == "RANGE"), None)
            proj = g.get("Projection") or {}
            gobj = {
                "name": g["IndexName"],
                "hash_key": gh,
                "projection_type": proj.get("ProjectionType", "ALL"),
                "non_key_attributes": proj.get("NonKeyAttributes") or [],
            }
            if gr:
                gobj["range_key"] = gr
            gsis.append(gobj)
        if gsis:
            obj["global_secondary_indexes"] = gsis

        lsis = []
        for l in t.get("LocalSecondaryIndexes") or []:
            lks = l.get("KeySchema", []) or []
            lr = next(k["AttributeName"] for k in lks if k["KeyType"] == "RANGE")
            proj = l.get("Projection") or {}
            lobj = {
                "name": l["IndexName"],
                "range_key": lr,
                "projection_type": proj.get("ProjectionType", "ALL"),
                "non_key_attributes": proj.get("NonKeyAttributes") or [],
            }
            lsis.append(lobj)
        if lsis:
            obj["local_secondary_indexes"] = lsis

        tables.append(obj)

    out_obj = {"tables": tables}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out_obj, indent=2))
    print(f"Wrote {args.out} with {len(tables)} tables.")

if __name__ == "__main__":
    main()
