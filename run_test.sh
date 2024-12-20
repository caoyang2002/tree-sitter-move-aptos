#!/bin/bash

# 设置严格模式
set -euo pipefail
IFS=$'\n\t'

# 定义颜色输出
RED='\033[0;31m'
NC='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

# 帮助信息函数
print_usage() {
  echo "Usage: $0 <directory_path>"
  echo "Scans for .move files in the specified directory"
  echo "If Move.toml exists, scans the sources directory"
  echo "Otherwise scans the specified directory"
}

# 错误处理函数
error_exit() {
  echo -e "${RED}Error: $1${NC}" >&2
  exit 1
}

# 日志函数
log_info() {
  echo -e "${GREEN}[INFO] $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

# 验证参数
if [ $# -ne 1 ]; then
  print_usage
  error_exit "Expected exactly one argument"
fi

directory="$1"

# 检查目录是否存在
if [ ! -d "$directory" ]; then
  error_exit "Directory '$directory' does not exist"
fi

# 检查是否安装了 tree-sitter
check_tree_sitter() {
  if ! command -v tree-sitter &>/dev/null; then
    error_exit "tree-sitter command not found. Please install tree-sitter first."
  fi
}

# 查找 Move 文件的函数
find_move_files() {
  local search_dir="$1"
  local file_count=0
  local files=()

  # 先检查是否有 .move 文件
  if ! find "$search_dir" -type f -name "*.move" -print0 | grep -q .; then
    log_warning "No .move files found in $search_dir"
    return 1
  fi

  log_info "Found .move files:"

  # 使用 while 循环处理找到的文件
  while IFS= read -r -d '' file; do
    echo "$file"
    files+=("$file")
    file_count=$((file_count + 1))
    # 对每个文件进行语法检查
    test_grammar "$file"
  done < <(find "$search_dir" -type f -name "*.move" -print0)

  log_info "Total files found: $file_count"
  return 0
}

# 使用 tree-sitter 解析 move 代码，并检查是否有 Error 输出
test_grammar() {
  local move_file="$1"
  local output
  local error_context=3

  log_info "Checking grammar for: $move_file"

  # 运行 tree-sitter 解析并捕获输出
  if ! output=$(tree-sitter parse "$move_file" 2>&1); then
    log_warning "Grammar check failed for: $move_file"

    # 获取错误行信息
    if echo "$output" | grep -q "(ERROR"; then
      # 提取错误位置
      local error_pos=$(echo "$output" | grep -o "(ERROR \[[0-9]*, [0-9]*\] - \[[0-9]*, [0-9]*\]")
      echo -e "\n${RED}═══════════════════════════════════════════${NC}"
      echo -e "${RED}Grammar Error in: ${NC}$move_file"
      echo -e "${RED}Error position:${NC} $error_pos"

      # 显示错误上下文
      local error_line=$(echo "$error_pos" | grep -o "\[[0-9]*," | tr -d '[],' | head -1)

      if [ -n "$error_line" ]; then
        echo -e "\nContext:"
        local start_line=$((error_line - error_context))
        [ $start_line -lt 1 ] && start_line=1
        local end_line=$((error_line + error_context))
        local current_line=$start_line

        # 显示带有高亮的错误行
        sed -n "${start_line},${end_line}p" "$move_file" |
          while IFS= read -r contextline; do
            if [ "$current_line" -eq "$error_line" ]; then

              echo -e "${RED}>>> $contextline${NC}"
            else
              echo "    $contextline"
            fi
            current_line=$((current_line + 1))
          done
      fi

      # 高亮显示 ERROR 部分
      echo -e "\nTree-sitter output:"
      echo "$output" | while IFS= read -r line; do
        if echo "$line" | grep -q "(ERROR"; then
          echo -e "${RED}$line${NC}"
        else
          echo "$line"
        fi
      done
    fi

    echo -e "\n${YELLOW}Common causes:${NC}"
    echo -e " • ${YELLOW}Syntax:${NC} Missing semicolons, brackets, or invalid syntax"
    echo -e " • ${YELLOW}Structure:${NC} Incorrect function or struct declarations"
    echo -e " • ${YELLOW}Naming:${NC} Invalid identifier names or keywords"
    echo -e " • ${YELLOW}Types:${NC} Incorrect type annotations or missing type information"

    echo -e "\n${GREEN}Suggestion:${NC} Check the above error location and verify:"
    echo "  1. All code blocks are properly closed"
    echo "  2. Semicolons are present where required"
    echo "  3. All types are properly declared"
    echo "  4. No invalid characters in the code\n"

    return 1
  else
    log_info "Grammar check passed for: $move_file"
    return 0
  fi
}

# 主要逻辑
main() {
  # 检查依赖
  check_tree_sitter

  # 检查 Move.toml 文件
  if [ -f "$directory/Move.toml" ]; then
    log_info "Found Move.toml, scanning sources directory"
    sources_dir="$directory/sources"

    if [ ! -d "$sources_dir" ]; then
      error_exit "Sources directory not found: $sources_dir"
    fi

    find_move_files "$sources_dir"
  else
    log_info "No Move.toml found, scanning specified directory"
    find_move_files "$directory"
  fi
}

# 执行主函数
main
