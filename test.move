module 0x42::two_resources {
  struct R1 has key { f: u64 }
  struct R2 has key { g: u64 }

  fun double_acquires(a: address): u64 acquires R1, R2 {
    borrow_global<R1>(a).f + borrow_global<R2>(a).g
  }
}
