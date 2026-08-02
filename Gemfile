source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 2.6.10"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'xcodeproj', '< 1.26.0'
# concurrent-ruby 1.3.5 dropped an implicit `require "logger"` that activesupport
# relies on, breaking `pod install` on Ruby < 3.2 (e.g. macOS system Ruby 2.6.10).
gem 'concurrent-ruby', '1.3.4'
