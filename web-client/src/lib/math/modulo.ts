// modulo helpers

// nonnegativeModulo perform modulo on the two values, where a may be negative.
// Returns a non-negative value.  "b" must be positive, but it is not checked.
// The scenario here is:
//    -8 % 10
// In the nodejs implementation, that returns -8.  However, the use of
// remainder in some contexts has the concept of a = x*b + r, such that
// r is a steady increment from 0 to b-1.  That's the usage described
// by this function - where along the [0, b) range is the remainder?
export function nonnegativeRemainder(a: integer, b: integer): integer {
  const ret = a % b
  if (ret < 0) {
    // -8 % 10 = -8,
    // but the result should be 2, because the remainder should be
    // in the range [0, 10) for the -10 block, which means
    // -10 + 2 == -8, so the remainder is 2 increments within the [-10,0)
    // block.
    return ret + b
  }
  return ret
}
