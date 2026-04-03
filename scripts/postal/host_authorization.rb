# frozen_string_literal: true

# Allow the internal Docker service hostname used by the app when calling Postal,
# plus any extra hosts provided by the deployer.
allowed_hosts = ["postal-web:5000"]
allowed_hosts.concat(
  ENV.fetch("POSTAL_ALLOWED_HOSTS", "").split(",").map(&:strip).reject(&:empty?)
)

allowed_hosts.uniq.each do |host|
  Rails.application.config.hosts << host
end