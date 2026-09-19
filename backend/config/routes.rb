Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    get "health", to: "health#show"
    get "props", to: "props#index"
    get "props/:id", to: "props#show"
    get "entries", to: "entries#index"
    post "entries", to: "entries#create"
  end
end
