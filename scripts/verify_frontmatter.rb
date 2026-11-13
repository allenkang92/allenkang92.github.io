#!/usr/bin/env ruby

require 'date'
require 'pathname'
require 'yaml'

module FrontmatterVerifier
  REQUIRED_STRING_FIELDS = %w[layout title description].freeze
  DATE_FIELDS = %w[date date_modified last_modified_at].freeze
  POST_GLOBS = ['**/*.md', '**/*.markdown'].freeze

  module_function

  def parse_front_matter(content, path)
    lines = content.lines
    unless lines.first && lines.first.match?(/\A---[ \t]*\r?\n?\z/)
      return [nil, ["#{display_path(path)}: front matter must start and end with ---"]]
    end

    closing_index = (1...lines.length).find do |index|
      lines[index].match?(/\A---[ \t]*\r?\n?\z/)
    end
    unless closing_index
      return [nil, ["#{display_path(path)}: front matter must start and end with ---"]]
    end

    source = lines[1...closing_index].join
    data = YAML.safe_load(source, permitted_classes: [Date, DateTime, Time], aliases: true)
    unless data.is_a?(Hash)
      return [nil, ["#{display_path(path)}: front matter must be a YAML mapping"]]
    end

    [data.transform_keys(&:to_s), []]
  rescue Psych::Exception, ArgumentError => error
    [nil, ["#{display_path(path)}: invalid YAML front matter (#{error.class})"]]
  end

  def validate_entry(data:, path:, categories:, series:)
    label = display_path(path)
    unless data.is_a?(Hash)
      return ["#{label}: front matter must be a YAML mapping"]
    end

    fields = data.transform_keys(&:to_s)
    errors = []

    REQUIRED_STRING_FIELDS.each do |field|
      value = fields[field]
      if !value.is_a?(String) || value.strip.empty?
        errors << "#{label}: '#{field}' must be a non-empty string"
      end
    end

    unless fields['layout'] == 'post'
      errors << "#{label}: 'layout' must be 'post'"
    end

    unless parsed_date(fields['date'])
      errors << "#{label}: 'date' must be a valid YAML date/time or parseable date string"
    end

    validate_modified_dates(fields, label, errors)
    validate_categories(fields['categories'], categories, label, errors)
    validate_tags(fields, label, errors)
    validate_series(fields, series, label, errors)

    errors
  end

  def validate_series_order_collisions(records)
    seen = {}
    errors = []

    records.each do |record|
      data = record[:data] || {}
      key = data['series']
      order = data['series_order']
      next unless key.is_a?(String) && order.is_a?(Integer)

      index_key = [key, order]
      if seen.key?(index_key)
        errors << "#{display_path(record[:path])}: duplicate series_order #{order} for '#{key}' (also used by #{display_path(seen[index_key])})"
      else
        seen[index_key] = record[:path]
      end
    end

    errors
  end

  def verify(posts_dir:, categories_path:, series_path:, achievements_dir: nil)
    errors = []
    categories_data, categories_errors = read_yaml_file(categories_path)
    series_data, series_errors = read_yaml_file(series_path)
    errors.concat(categories_errors)
    errors.concat(series_errors)
    return errors unless errors.empty?

    category_registry = categories_data['main']
    unless category_registry.is_a?(Hash) && !category_registry.empty?
      return ["#{display_path(categories_path)}: expected a non-empty 'main' category registry"]
    end

    series_items = series_data['items']
    unless series_items.is_a?(Array)
      return ["#{display_path(series_path)}: expected an 'items' array"]
    end

    category_keys = category_registry.keys.map(&:to_s)
    series_keys = series_items.each_with_object([]) do |item, keys|
      keys << item['key'] if item.is_a?(Hash) && item['key'].is_a?(String) && !item['key'].strip.empty?
    end

    post_paths = POST_GLOBS.flat_map { |pattern| Dir.glob(File.join(posts_dir.to_s, pattern)) }.uniq.sort
    return ["#{display_path(posts_dir)}: no Markdown posts found"] if post_paths.empty?

    records = []
    post_paths.each do |post_path|
      content = File.read(post_path, encoding: 'UTF-8')
      data, parse_errors = parse_front_matter(content, post_path)
      errors.concat(parse_errors)
      next unless data

      records << { path: post_path, data: data }
      errors.concat(validate_entry(data: data, path: post_path, categories: category_keys, series: series_keys))
    rescue SystemCallError, EncodingError => error
      errors << "#{display_path(post_path)}: unable to read UTF-8 post (#{error.class})"
    end

    errors.concat(validate_series_order_collisions(records))
    if achievements_dir
      # Jekyll collections accept YAML-front-matter documents of any extension,
      # while entries without front matter are static files.
      achievement_paths(achievements_dir, errors).each do |achievement_path, source_path|
        has_header = File.open(source_path, 'rb') { |file| file.gets.to_s.match?(/\A---[ \t]*\r?\n/) }
        next unless has_header

        content = File.read(source_path, encoding: 'UTF-8')
        data, parse_errors = parse_front_matter(content, achievement_path)
        errors.concat(parse_errors)
        next unless data

        errors.concat(validate_achievement_urls(data: data, path: achievement_path))
      rescue SystemCallError, EncodingError => error
        errors << "#{display_path(achievement_path)}: unable to read UTF-8 achievement (#{error.class})"
      end
    end
    errors
  rescue SystemCallError, EncodingError => error
    ["Front matter registry could not be read (#{error.class})"]
  end

  # Follow internal file links like Jekyll does, but never traverse directory
  # links or read targets outside the site root. Report skipped links explicitly.
  def achievement_paths(directory, errors)
    directory_path = File.expand_path(directory.to_s)
    if File.symlink?(directory_path)
      errors << "#{display_path(directory)}: achievement directory cannot be a symbolic link"
      return []
    end

    site_root = File.realpath(File.dirname(directory_path))
    root_prefix = site_root.end_with?(File::SEPARATOR) ? site_root : site_root + File::SEPARATOR
    Dir.glob(File.join(directory_path, '**', '*')).sort.each_with_object([]) do |path, paths|
      if File.symlink?(path)
        begin
          target = File.realpath(path)
          unless target == site_root || target.start_with?(root_prefix)
            errors << "#{display_path(path)}: symbolic link target is outside the site root"
            next
          end
          unless File.file?(target)
            errors << "#{display_path(path)}: symbolic link must target a regular file, not a directory"
            next
          end
          paths << [path, target]
        rescue SystemCallError => error
          errors << "#{display_path(path)}: symbolic link target cannot be resolved (#{error.class})"
        end
      elsif File.file?(path)
        paths << [path, path]
      end
    end
  end

  # Keep this policy aligned with _includes/components/achievement-url.html.
  # It rejects dangerous URL forms; it is not a complete URL or host parser.
  def achievement_url_error(value)
    return '문자열이어야 합니다' unless value.is_a?(String)
    return '빈 주소는 사용할 수 없습니다' if value.empty?
    return '주소 앞뒤에 공백을 사용할 수 없습니다' if value != value.strip || value.match?(/\A[[:space:]]|[[:space:]]\z/u)
    return '제어문자와 역슬래시는 사용할 수 없습니다' if value.match?(/[\x00-\x1f\x7f\\]/)

    lower = value.downcase
    http_prefix = lower.start_with?('http://')
    https_prefix = lower.start_with?('https://')
    protocol_relative = value.start_with?('//')
    head = value.split(/[\/?#]/, 2).first.to_s
    if head.include?(':') && !http_prefix && !https_prefix
      return '명시적 스킴은 http:// 또는 https://만 허용합니다'
    end

    if http_prefix || https_prefix || protocol_relative
      authority = value[(https_prefix ? 8 : http_prefix ? 7 : 2)..-1].to_s.split(/[\/?#]/, 2).first.to_s
      return '호스트가 비어 있습니다' if authority.empty?
    end
    nil
  end

  def validate_achievement_urls(data:, path:)
    fields = data.transform_keys(&:to_s)
    %w[certificate_image project_detail].each_with_object([]) do |field, errors|
      # Explicit false is a conventional way to disable an inherited field.
      next unless fields.key?(field) && !fields[field].nil? && fields[field] != false

      reason = achievement_url_error(fields[field])
      errors << "#{display_path(path)}: '#{field}' #{reason}" if reason
    end
  end

  def read_yaml_file(path)
    data = YAML.safe_load(File.read(path, encoding: 'UTF-8'), permitted_classes: [Date, DateTime, Time], aliases: true)
    return [nil, ["#{display_path(path)}: expected a YAML mapping"]] unless data.is_a?(Hash)

    [data.transform_keys(&:to_s), []]
  rescue Psych::Exception, SystemCallError, EncodingError => error
    [nil, ["#{display_path(path)}: invalid YAML registry (#{error.class})"]]
  end

  def parsed_date(value)
    case value
    when Time
      value.to_datetime
    when DateTime
      value
    when Date
      value.to_datetime
    when String
      DateTime.parse(value)
    else
      nil
    end
  rescue ArgumentError
    nil
  end

  def validate_modified_dates(fields, label, errors)
    keys = DATE_FIELDS.drop(1).select { |field| fields.key?(field) }
    if keys.empty? || keys.all? { |field| fields[field].nil? }
      errors << "#{label}: provide 'date_modified' or 'last_modified_at'"
      return
    end

    parsed = {}
    keys.each do |field|
      parsed[field] = parsed_date(fields[field])
      unless parsed[field]
        errors << "#{label}: '#{field}' must be a valid YAML date/time or parseable date string"
      end
    end

    if parsed['date_modified'] && parsed['last_modified_at'] && parsed['date_modified'] != parsed['last_modified_at']
      errors << "#{label}: 'date_modified' and 'last_modified_at' must match"
    end
  end

  def validate_categories(value, registry, label, errors)
    unless value.is_a?(Array) && !value.empty?
      errors << "#{label}: 'categories' must be a non-empty array of registered category keys"
      return
    end

    unless value.all? { |category| category.is_a?(String) && !category.strip.empty? }
      errors << "#{label}: every category must be a non-empty string"
      return
    end

    duplicates = value.group_by(&:itself).select { |_category, instances| instances.length > 1 }.keys
    errors << "#{label}: duplicate categories #{duplicates.join(', ')}" unless duplicates.empty?

    unknown = value.uniq.reject { |category| registry.include?(category) }
    errors << "#{label}: unregistered categories #{unknown.join(', ')}" unless unknown.empty?
  end

  def validate_tags(fields, label, errors)
    return unless fields.key?('tags')

    value = fields['tags']
    values = value.is_a?(Array) ? value : [value]
    unless values.all? { |tag| tag.is_a?(String) && !tag.strip.empty? }
      errors << "#{label}: 'tags' must be a string or an array of non-empty strings"
    end
  end

  def validate_series(fields, registry, label, errors)
    has_series = fields.key?('series') && !fields['series'].nil?
    order_present = fields.key?('series_order')

    if has_series
      series = fields['series']
      if !series.is_a?(String) || series.strip.empty?
        errors << "#{label}: 'series' must be a non-empty registered series key"
      elsif !registry.include?(series)
        errors << "#{label}: unregistered series '#{series}'"
      end

      order = fields['series_order']
      unless order.is_a?(Integer) && order >= 0
        errors << "#{label}: 'series_order' must be a non-negative integer when 'series' is set"
      end
    elsif order_present
      errors << "#{label}: 'series_order' requires 'series'"
    end
  end

  def display_path(path)
    path.to_s.dup.force_encoding(Encoding::UTF_8)
  end
end

if $PROGRAM_NAME == __FILE__
  STDOUT.set_encoding(Encoding::UTF_8)
  root = Pathname.new(__dir__).parent
  errors = FrontmatterVerifier.verify(
    posts_dir: root.join('_posts'),
    categories_path: root.join('_data', 'categories.yml'),
    series_path: root.join('_data', 'series.yml'),
    achievements_dir: root.join('_achievements'),
  )

  if errors.empty?
    post_count = Dir.glob(File.join(root.join('_posts').to_s, '**', '*.{md,markdown}')).length
    puts "PASS: #{post_count} posts have valid front matter, categories, dates, and series order; explicit achievement URLs follow the input policy"
  else
    warn "FAIL: #{errors.length} front matter issue(s)"
    errors.each { |error| warn "- #{error}" }
    exit 1
  end
end
