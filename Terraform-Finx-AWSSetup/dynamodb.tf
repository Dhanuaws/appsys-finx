resource "aws_dynamodb_table" "raw_email_metadata" {
  name         = "RawEmailMetaData"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "MessageID"
  range_key    = "ReceivedDate"
  table_class  = "STANDARD"

  attribute {
    name = "MessageID"
    type = "S"
  }

  attribute {
    name = "ReceivedDate"
    type = "S"
  }

  # Note: The original table had an index "FileHash-index" which was referenced
  # in the IAM policies. We will not define it here unless required, as it was
  # missing from the describe-table attributes unless described with indexes.
}
