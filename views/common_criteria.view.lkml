view: common_criteria {
  sql_table_name: `career-path-dataviz-prod.career.CommonCriteria` ;;

  dimension: first_activities {
    type: string
    sql: ${TABLE}.FirstActivities ;;
  }
  dimension: first_category {
    type: string
    sql: ${TABLE}.FirstCategory ;;
  }
  dimension: first_job {
    type: string
    sql: ${TABLE}.FirstJob ;;
  }
  dimension: first_techno_methodo {
    type: string
    sql: ${TABLE}.FirstTechnoMethodo ;;
  }
  dimension: second_activities {
    type: string
    sql: ${TABLE}.SecondActivities ;;
  }
  dimension: second_category {
    type: string
    sql: ${TABLE}.SecondCategory ;;
  }
  dimension: second_job {
    type: string
    sql: ${TABLE}.SecondJob ;;
  }
  dimension: second_techno_methodo {
    type: string
    sql: ${TABLE}.SecondTechnoMethodo ;;
  }
  measure: count {
    type: count
  }

}
