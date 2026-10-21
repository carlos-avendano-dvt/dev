- dashboard: regional_command_center
  title: "⚡ Regional Revenue & Orders Command Center"
  layout: newspaper
  preferred_viewer: dashboards-next
  description: "Data App React Command Center — Modelo carlos-training-looker (Carpeta: agentic_dashboards)"
  filters:
  - name: created_date
    title: "Selector de Fechas (Created Date)"
    type: field_filter
    default_value: "7 months"
    allow_multiple_values: true
    required: false
    ui_config:
      type: relative_timeframes
      display: inline
      options: []
    model: carlos-training-looker
    explore: order_items
    listens_to_filters: []
    field: order_items.created_date

  elements:
  - title: "⚡ Regional Revenue & Orders Command Center"
    name: command_center_main
    model: carlos-training-looker
    explore: order_items
    type: "carlos-training-looker::regional_command_center_vis"
    fields: [order_items.created_month, users.country, order_items.order_count, order_items.total_revenue]
    sorts: [order_items.created_month desc, order_items.total_revenue desc]
    limit: 500
    title_hidden: true
    listen:
      created_date: order_items.created_date
    row: 0
    col: 0
    width: 24
    height: 26
