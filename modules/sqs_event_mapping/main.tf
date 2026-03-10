resource "aws_lambda_event_source_mapping" "this" {
  event_source_arn                   = var.event_source_arn
  function_name                      = var.consumer_lambda_arn
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window_in_seconds
  enabled                            = var.enabled
}
