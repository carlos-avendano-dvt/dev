# Define the database connection to be used for this model.
connection: "carlos-looker-training"

# include all the views
include: "//Sports/views/**/*.view"
include: "/views/**/*.view.lkml"
include: "/derived_tables/**/*.view.lkml"
include: "/dashboards/*.dashboard.lookml"
# Datagroups define a caching policy for an Explore. To learn more,
# use the Quick Help panel on the right to see documentation.

datagroup: carlos_training_looker_default_datagroup {
  # sql_trigger: SELECT MAX(id) FROM etl_log;;
  max_cache_age: "1 hour"
  sql_trigger: SELECT max(id) FROM my_tablename ;;
}

access_grant: access_test {
  user_attribute: test_grant
  allowed_values: [ "yes" ]
}

persist_with: carlos_training_looker_default_datagroup

map_layer: test_map {
  file: "/maps/final_modified.topojson"
}

map_layer: provinces {
  file: "/maps/spain-provinces-geo.geojson"
}

map_layer: municipios {
  file: "/maps/spain-municipalities.geojson"
}

map_layer: comunidades {
  file: "/maps/spain-communities.geojson"
}

map_layer: postal {
  file: "/maps/spain-postalcodes.topojson"
}


# Explores allow you to join together different views (database tables) based on the
# relationships between fields. By joining a view into an Explore, you make those
# fields available to users for data analysis.
# Explores should be purpose-built for specific use cases.

# To see the Explore you’re building, navigate to the Explore menu and select an Explore under "Carlos-training-looker"

# To create more sophisticated Explores that involve multiple views, you can use the join parameter.
# Typically, join parameters require that you define the join type, join relationship, and a sql_on clause.
# Each joined view also needs to define a primary key.

explore: bq_queries {


}


explore: inventory_items {
}


explore: products {
  always_filter: {
    filters: [category: "Accessories"]
  }

}


explore: distribution_centers {}

explore: orders {}

explore: events {}

explore: users {
  # always_filter: {
  # filters: [age: "20"]
  # }
   # sql_always_where: ${age}=20 ;;
}


explore: order_items {



# sql_always_where: ${distribution_centers.name} = "Houston TX" ;;


  # access_filter: {
  #   field: status
  # user_attribute: status_filter_2
  # }



  join: users {
    type: left_outer
    sql_on: ${order_items.user_id} = ${users.id} ;;
    relationship: many_to_one
  }
  join: inventory_items {
    type: left_outer
    sql_on: ${order_items.inventory_item_id} = ${inventory_items.id} ;;
    relationship: many_to_one
  }

  join: products {
    type: left_outer
    sql_on: ${inventory_items.product_id} = ${products.id} ;;
    relationship: many_to_one
  }

  join: distribution_centers {
    type: left_outer
    sql_on: ${products.distribution_center_id} = ${distribution_centers.id} ;;
    relationship: many_to_one
  }
  join: order_details {
    type:  left_outer
    sql_on: ${order_items.order_id} = ${order_details.order_id} ;;
    relationship: many_to_one
  }




}

explore: order_items_2 {
  extends: [order_items]
  view_name: order_items
  label: "Order Items (Users > 30)"
  sql_always_where: ${users.age} > 30 ;;
}

explore: order_items_3 {
    label: "Order Items and Details"
    view_name: order_items
    join: order_details {
      type:  left_outer
      sql_on: ${order_items.order_id} = ${order_details.order_id} ;;
      relationship: many_to_one
    }
    join: users {
      type: left_outer
      sql_on: ${order_items.user_id} = ${users.id} ;;
      relationship: many_to_one
  }
}

explore: renta_municipios_refined {}
explore: ccaa_esperanza_vida_refined{}
explore: ccaa_ejercicio_refined {}
explore: flexible_pop8 {
  label: "LPoP Method 8: Flexible implementation to compare any period to any other"
  from:  pop_method_8
  view_name: pop_method_8

  # No editing needed - make sure we always join and set up always filter on the hidden config dimensions
  always_join: [within_periods,over_periods]

  always_filter: {
    filters: [date_filter:  "last 12 weeks", within_period_type: "week", over_period_type: "year"]
  }

  # No editing needed
join: within_periods {
  from: numbers_method8
  type: left_outer
  relationship: one_to_many
  fields: []
  sql_on: ${within_periods.n} < (
    CASE
      WHEN {% parameter pop_method_8.within_period_type %} = 'hour' THEN
        (TIMESTAMP_DIFF(
          TIMESTAMP({% date_end pop_method_8.date_filter %}),
          TIMESTAMP({% date_start pop_method_8.date_filter %}),
          HOUR
        ) - 1)  * 24
      WHEN {% parameter pop_method_8.within_period_type %} = 'day' THEN
        (DATE_DIFF(
          DATE(TIMESTAMP({% date_end pop_method_8.date_filter %})),
          DATE(TIMESTAMP({% date_start pop_method_8.date_filter %})),
          DAY
        ) - 1)
      WHEN {% parameter pop_method_8.within_period_type %} = 'week' THEN
        (DATE_DIFF(
          DATE(TIMESTAMP({% date_end pop_method_8.date_filter %})),
          DATE(TIMESTAMP({% date_start pop_method_8.date_filter %})),
          WEEK
        ) - 1)
      WHEN {% parameter pop_method_8.within_period_type %} = 'month' THEN
        (DATE_DIFF(
          DATE(TIMESTAMP({% date_end pop_method_8.date_filter %})),
          DATE(TIMESTAMP({% date_start pop_method_8.date_filter %})),
          MONTH
        ) - 1)
      WHEN {% parameter pop_method_8.within_period_type %} = 'quarter' THEN
        (DATE_DIFF(
          DATE(TIMESTAMP({% date_end pop_method_8.date_filter %})),
          DATE(TIMESTAMP({% date_start pop_method_8.date_filter %})),
          QUARTER
        ) - 1)
      ELSE
        (DATE_DIFF(
          DATE(TIMESTAMP({% date_end pop_method_8.date_filter %})),
          DATE(TIMESTAMP({% date_start pop_method_8.date_filter %})),
          DAY
        ) - 1)
    END
  );;
}





  # No editing needed
  join: over_periods {
    from: numbers_method8
    view_label: "_PoP"
    type: left_outer
    relationship: one_to_many
    sql_on:
      CASE WHEN {% condition pop_method_8.over_how_many_past_periods %} NULL {% endcondition %}
      THEN
        ${over_periods.n} <= 1
      ELSE
        {% condition pop_method_8.over_how_many_past_periods %} ${over_periods.n} {% endcondition %}
      END;;

  }


  # Rename (& optionally repeat) below join to match your pop view(s)
  join: pop_order_items_method_8 {
    from: pop_order_items_method_8
    type: left_outer
    relationship: many_to_one
    sql_on:
    CASE

    WHEN {% parameter pop_method_8.within_period_type %} = 'hour' THEN
        DATE(DATE_TRUNC(
          DATE_ADD(DATE_ADD({% date_end pop_method_8.date_filter %}, INTERVAL (0 - ${within_periods.n}) HOUR), INTERVAL (0 - ${over_periods.n}) HOUR),
          HOUR
        ))
    WHEN {% parameter pop_method_8.within_period_type %} = 'week' THEN
        DATE(DATE_TRUNC(
          DATE_ADD(DATE_ADD(DATE({% date_end pop_method_8.date_filter %}), INTERVAL (0 - ${within_periods.n}) WEEK), INTERVAL (0 - ${over_periods.n}) WEEK),
          WEEK
        ))


      WHEN {% parameter pop_method_8.within_period_type %} = 'day' THEN
        DATE(DATE_TRUNC(
          DATE_ADD(TIMESTAMP_ADD(TIMESTAMP({% date_end pop_method_8.date_filter %}), INTERVAL (0 - ${within_periods.n}) DAY), INTERVAL (0 - ${over_periods.n}) DAY),
          DAY
        ))

      WHEN {% parameter pop_method_8.within_period_type %} = 'month' THEN
        DATE(DATE_TRUNC(
          DATE_ADD(DATE_ADD(DATE({% date_end pop_method_8.date_filter %}), INTERVAL (0 - ${within_periods.n}) MONTH), INTERVAL (0 - ${over_periods.n}) MONTH),
          MONTH
        ))
      WHEN {% parameter pop_method_8.within_period_type %} = 'quarter' THEN
        DATE(DATE_TRUNC(
          DATE_ADD(DATE_ADD(DATE({% date_end pop_method_8.date_filter %}), INTERVAL (0 - ${within_periods.n}) QUARTER), INTERVAL (0 - ${over_periods.n}) QUARTER),
          QUARTER
        ))
      ELSE
        DATE(DATE_TRUNC(
          DATE_ADD(TIMESTAMP_ADD(TIMESTAMP({% date_end pop_method_8.date_filter %}), INTERVAL (0 - ${within_periods.n}) DAY), INTERVAL (0 - ${over_periods.n}) DAY),
          DAY
        ))
    END
    = DATE(pop_order_items_method_8.join_date) ;;
  }
}

explore: pop_parameters_multi_period {
  label: "PoP Method 4: Compare multiple templated periods"

  sql_always_where:
            {% if pop_parameters_multi_period.current_date_range._is_filtered %} {% condition pop_parameters_multi_period.current_date_range %} ${created_raw} {% endcondition %}
            {% if pop_parameters_multi_period.previous_date_range._is_filtered or pop_parameters_multi_period.compare_to._in_query %}
            {% if pop_parameters_multi_period.comparison_periods._parameter_value == "2" %}
                or DATE(${created_raw}) between  DATE(${period_2_start}) and  DATE(${period_2_end})
{% elsif pop_parameters_multi_period.comparison_periods._parameter_value == "3" %}
    or DATE(${created_raw}) BETWEEN DATE(${period_2_start}) AND DATE(${period_2_end})
    or DATE(${created_raw}) BETWEEN DATE(${period_3_start}) AND DATE(${period_3_end})
            {% elsif pop_parameters_multi_period.comparison_periods._parameter_value == "4" %}
                or  DATE(${created_raw}) between  DATE(${period_2_start}) and  DATE(${period_2_end})
                or  DATE(${created_raw}) between  DATE(${period_3_start})and  DATE(${period_3_end}) or  DATE(${created_raw}) between  DATE(${period_4_start}) and  DATE(${period_4_end})
            {% else %} 1 = 1
            {% endif %}
            {% endif %}
            {% else %} 1 = 1
            {% endif %};;
}

explore: flexible_pop {
  label: "PoP Method 8: Flexible implementation to compare any period to any other"
  from: pop
  view_name: pop

  # No editing needed - make sure we always join and set up always filter on the hidden config dimensions
  always_join: [within_periods, over_periods]
  always_filter: {
    filters: [pop.date_filter: "last 12 weeks", pop.within_period_type: "week", pop.over_period_type: "year"]
  }

  # No editing needed
  join: within_periods {
    from: numbers
    type: left_outer
    relationship: one_to_many
    fields: []
    # This join creates fanout, creating one additional row per required period
    # Here we calculate the size of the current period, in the units selected by the filter
    sql_on: ${within_periods.n}
                <= (DATE_DIFF({% date_end pop.date_filter %}, {% date_start pop.date_filter %}, {% parameter pop.within_period_type %}) - 1)
                 * CASE WHEN {% parameter pop.within_period_type %} = 'hour' THEN 24 ELSE 1 END;;
  }

  # No editing needed
  join: over_periods {
    from: numbers
    view_label: "_PoP"
    type: left_outer
    relationship: one_to_many
    sql_on:
                      CASE WHEN {% condition pop.over_how_many_past_periods %} NULL {% endcondition %}
                      THEN
                        ${over_periods.n} <= 1
                      ELSE
                        {% condition pop.over_how_many_past_periods %} ${over_periods.n} {% endcondition %}
                      END;;
  }

  # Rename (& optionally repeat) below join to match your pop view(s)
  join: pop_order_items_created {
    type: left_outer
    relationship: many_to_one
    # Apply join name below in sql_on
    sql_on: pop_order_items_created.join_date = DATE_TRUNC({% parameter pop.within_period_type %},
      DATE_ADD({% date_end pop.date_filter %}, INTERVAL 0 - ${over_periods.n} {% parameter pop.over_period_type %}),
      DATE_ADD({% date_end pop.date_filter %}, INTERVAL 0 - ${within_periods.n} {% parameter pop.within_period_type %})
    );;
  }
}






























access_grant: access_organizacion {
  user_attribute: organizacion
  allowed_values: [ "administrador" ]
}

explore: dojos_aikido {

 #access_filter: {
 #field: organizaci__n
 #user_attribute: organizacion
 #}

}
