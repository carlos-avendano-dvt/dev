# Modelo de prueba para MCP
connection: "carlos-looker-training"

# Incluir las vistas necesarias
include: "/views/looker/*.view.lkml"

# Explore de prueba basado en la vista de usuarios
explore: users {
  label: "MCP Test - Users"
}
