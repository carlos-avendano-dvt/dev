project_name: "carlos-training-looker"

application: regional_command_center {
  label: "⚡ Regional Revenue & Orders Command Center"
  file: "command_center_bundle.js"
  entitlements: {
    local_storage: yes
    navigation: yes
    new_window: yes
    new_window_external_urls: ["https://nubalia.cloud.looker.com/*"]
    use_form_submit: yes
    use_embeds: yes
    use_clipboard: yes
    core_api_methods: ["run_inline_query", "all_lookml_models", "lookml_model_explore", "me"]
  }
}

application: tldd {
  label: "tldd"
  url: "https://storage.googleapis.com/tldd-frontend/bundle.js"
  entitlements: {
    use_clipboard: yes
    use_form_submit: yes
    external_api_urls: ["https://vertex-dashboards-2w54ohrt4q-uc.a.run.app", "https://localhost:8080"]
    global_user_attributes: ["looker_hackathon_vertexai_tldd_api"]
  }
}

# The project to import
local_dependency: {
  project: "Sports"
}
