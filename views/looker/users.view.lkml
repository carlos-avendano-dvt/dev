# The name of this view in Looker is "Users"
view: users {
  # The sql_table_name parameter indicates the underlying database table
  # to be used for all fields in this view.
  sql_table_name: `looker.users` ;;

  # No primary key is defined for this view. In order to join this view in an Explore,
  # define primary_key: yes on a dimension that has no repeated values.

    # Here's what a typical dimension looks like in LookML.
    # A dimension is a groupable field that can be used to filter query results.
    # This dimension will be called "Age" in Explore.

dimension: id {
  primary_key: yes
  type: number
  sql: ${TABLE}.id ;;
}

dimension: age {
  type: number
  sql: ${TABLE}.age ;;
}

  dimension: age_tier {

    type: tier

    tiers: [18, 25, 35, 45, 55, 65, 75, 90]

    sql: ${age} ;;

    style: interval

  }




dimension: city {
  type: string
  sql: ${TABLE}.city ;;
}

dimension: country {
  type: string
  map_layer_name: countries
  sql: ${TABLE}.country ;;
}

dimension_group: created {
  type: time
  timeframes: [
    raw,
    time,
    date,
    week,
    month,
    quarter,
    year
  ]
  sql: ${TABLE}.created_at ;;
}


  dimension: days_since_signup {

    type: number

    sql: DATE_DIFF(current_date(), ${created_date}, DAY);;

  }

dimension: email {
  type: string
  sql: ${TABLE}.email ;;
}

dimension: first_name {
  type: string
  sql: ${TABLE}.first_name ;;
}

dimension: gender {
  type: string
  sql: ${TABLE}.gender ;;
}

dimension: last_name {
  type: string
  sql: ${TABLE}.last_name ;;
}


dimension: latitude {
  type: number
  sql: ${TABLE}.latitude ;;
}

dimension: longitude {
  type: number
  sql: ${TABLE}.longitude ;;
}

dimension: state {
  type: string
  sql: ${TABLE}.state ;;
  map_layer_name: us_states
}

dimension: traffic_source {
  type: string
  sql: ${TABLE}.traffic_source ;;
}


  dimension: is_email_source {

    type: yesno

    sql: ${traffic_source} = "Email" ;;

  }

dimension: zips {
  type: zipcode
  sql: ${TABLE}.zip ;;
}

  dimension: full_name {

    type: string

    sql: concat(${first_name},"  ", ${last_name}) ;;

  }

measure: users_sum {
  type: sum
  sql: ${id} ;;
}

  measure: users_sum_pop_mes {
    type: period_over_period
    based_on: users.users_sum
    based_on_time: users.created_month
    period: year
    kind: previous
  }



  parameter: fecha_analisis {
    type: date
    label: "1. Seleccionar Fecha de Análisis"
    description: "Usa este filtro obligatorio para activar las métricas MTD, YTD y comparativas."
  }

# ¿La fila pertenece al MTD actual?

  dimension: es_mtd {
    type: yesno
    hidden: yes
    sql: ${created_date} >= DATE_TRUNC(DATE({% parameter fecha_analisis %}), MONTH)
      AND ${created_date} <= DATE({% parameter fecha_analisis %}) ;;
  }

# ¿La fila pertenece al YTD actual?
  dimension: es_ytd {
    type: yesno
    hidden: yes
    sql: ${created_date} >= DATE_TRUNC(DATE({% parameter fecha_analisis %}), YEAR)
      AND ${created_date} <= DATE({% parameter fecha_analisis %}) ;;
  }

# ¿La fila corresponde exactamente al mismo día del año anterior?
  dimension: es_mdaa {
    type: yesno
    hidden: yes
    sql: ${created_date} = DATE_SUB(DATE({% parameter fecha_analisis %}), INTERVAL 1 YEAR) ;;
  }

# ¿La fila corresponde exactamente al mismo día del mes anterior?
  dimension: es_mdma {
    type: yesno
    hidden: yes
    sql: ${created_date} = DATE_SUB(DATE({% parameter fecha_analisis %}), INTERVAL 1 MONTH) ;;
  }

# Métrica Base

  measure: volumen {
    type: sum
    sql: ${TABLE}.id ;;
    label: "Volumen Total"
  }

# Métrica MTD
  measure: volumen_mtd {
    type: sum
    sql: ${TABLE}.id ;;
    filters: [es_mtd: "yes"]
    label: "Volumen MTD"
  }

# Métrica YTD
  measure: volumen_ytd {
    type: sum
    sql: ${TABLE}.id ;;
    filters: [es_ytd: "yes"]
    label: "Volumen YTD"
  }

# Métrica MDAA
  measure: volumen_mdaa {
    type: sum
    sql: ${TABLE}.id ;;
    filters: [es_mdaa: "yes"]
    label: "Volumen Mismo Día Año Anterior"
  }

# Métrica MDMA
  measure: volumen_mdma {
    type: sum
    sql: ${TABLE}.id;;
    filters: [es_mdma: "yes"]
    label: "Volumen Mismo Día Mes Anterior"
  }




measure: count {
  type: count
  drill_fields: [id, last_name, first_name, events.count, order_items.count]
}
}
