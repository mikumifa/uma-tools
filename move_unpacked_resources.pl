use strict;
use warnings;
use v5.28;

use File::Basename;
use File::Copy;
use File::Path qw(make_path remove_tree);

if (!@ARGV) {
	die 'Usage: move_unpacked_resources.pl <destination>';
}

my $dest = shift @ARGV;

my @files = glob("need_unpack/unpacked/**/**/*.png");

make_path($dest);

for my $f (@files) {
	my $base = basename($f);
	move($f, "$dest/$base");
}

remove_tree('need_unpack/unpacked', {safe => 1, keep_root => 1});
unlink glob("need_unpack/*");
