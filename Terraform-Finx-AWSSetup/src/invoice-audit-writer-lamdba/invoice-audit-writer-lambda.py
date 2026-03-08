"""
Lambda 3: Invoice Audit Writer (FINAL – SAFE FOR YOUR TABLE)
------------------------------------------------------------

Table: InvoiceAuditLayer
Partition Key: AuditId (String)
Trigger: SQS

Compatible with:
- Lambda1 (Hash duplicate, Business duplicate, ERP duplicate)
- Lambda2 (InvoiceNumber duplicate, runtime failure)

Author: AppSys inVi Audit Layer – FINAL VERSION
"""

import json
import uuid
import boto3
import os
from datetime import datetime, timezone
from decimal import Decimal


# ----------------------------
# CONFIG
# ----------------------------

DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "InvoiceAuditLayer")


# ----------------------------
# AWS CLIENT
# ----------------------------

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMODB_TABLE)


# ----------------------------
# HELPERS
# ----------------------------

def now_iso():

    return datetime.now(timezone.utc).isoformat()


def generate_audit_id():

    return str(uuid.uuid4())


def safe_string(value, max_len=500):

    if value is None:
        return ""

    return str(value)[:max_len]


def convert_decimal(value):

    if isinstance(value, float):
        return Decimal(str(value))

    return value


def parse_sqs_body(body):

    """
    Handles both normal JSON and nested SNS-style JSON
    """

    data = json.loads(body)

    if isinstance(data, dict) and "Message" in data:

        try:

            return json.loads(data["Message"])

        except:

            return data

    return data


# ----------------------------
# BUILD RECORD
# ----------------------------

def build_audit_record(event):

    """
    Builds DynamoDB record exactly matching your table schema
    """

    audit_id = event.get("eventId")

    if not audit_id:

        audit_id = generate_audit_id()


    record = {

        # Primary key
        "AuditId": safe_string(audit_id, 80),

        # Timestamp
        "DetectedAt": safe_string(
            event.get("DetectedAt") or event.get("emittedAt") or now_iso(),
            60
        ),

        # Decision info
        "Decision": safe_string(event.get("Decision"), 50),

        "RejectLayer": safe_string(event.get("RejectLayer"), 100),

        "RejectCode": safe_string(event.get("RejectCode"), 200),

        "RejectReason": safe_string(event.get("RejectReason"), 1000),


        # Invoice fields
        "InvoiceNumber": safe_string(event.get("InvoiceNumber"), 200),

        "Supplier": safe_string(
            event.get("Supplier") or event.get("VendorName"),
            300
        ),

        "SupplierSite": safe_string(event.get("SupplierSite"), 200),

        "InvoiceAmount": safe_string(event.get("InvoiceAmount"), 100),

        "InvoiceCurrency": safe_string(event.get("InvoiceCurrency"), 50),


        # Matching identifiers
        "DocumentHash": safe_string(event.get("DocumentHash"), 200),

        "BusinessKey": safe_string(event.get("BusinessKey"), 300),


        # S3 pointers
        "RawEmailS3Path": safe_string(event.get("RawEmailS3Path"), 500),

        "SilverS3Path": safe_string(event.get("SilverS3Path"), 500),

        "SourceFileName": safe_string(event.get("SourceFileName"), 300),


        # Email info
        "MessageID": safe_string(event.get("MessageID"), 300),

        "Sender": safe_string(event.get("Sender"), 300),

        "Subject": safe_string(event.get("Subject"), 500),


        # Optional metadata
        "Confidence": convert_decimal(
            event.get("Confidence", 1.0)
        )

    }


    return record


# ----------------------------
# WRITE TO DYNAMODB
# ----------------------------

def write_audit_record(record):

    """
    Safe write.
    No condition expression.
    Because your AuditId is always unique UUID.
    """

    table.put_item(

        Item=record

    )


# ----------------------------
# MAIN HANDLER
# ----------------------------

def lambda_handler(event, context):

    print("Lambda3 triggered")

    records = event.get("Records", [])

    print("Records received:", len(records))


    success = 0

    failed = 0


    for record in records:

        try:

            body = parse_sqs_body(record["body"])

            audit_record = build_audit_record(body)

            print("Writing audit record:", audit_record["AuditId"])

            write_audit_record(audit_record)

            success += 1


        except Exception as e:

            print("ERROR writing audit record:", str(e))

            failed += 1


    print("SUCCESS:", success)

    print("FAILED:", failed)


    return {

        "statusCode": 200,

        "body": json.dumps({

            "success": success,

            "failed": failed

        })

    }