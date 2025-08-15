use strict;
use warnings;
use v5.28;
use utf8;

use Cwd 'abs_path';
use File::Basename;
use File::Copy;
use File::Slurper 'read_binary';
use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

use Encoding qw(encode decode);
# NONE OF THIS SHIT WORKS
# I HAVE TRIED EVERY COMBINATION OF binmode(), use open qw(:std :utf8), OutputCP(), etc etc
# PROBABLY IT WORKS ON NORMAL WINDOWS BUT MY LOCALE IS SET TO JAPAN
# THE ONLY THING THAT WORKS IS encode('cp932', decode('utf8', $str))
#binmode(STDOUT, ':encoding(utf8)');
#use Win32::Console;
#Win32::Console::OutputCP(65001);

if (!@ARGV) {
	die 'Usage: make_uma_info.pl master.mdb';
}

my $mastermdb = shift @ARGV;
my $root = dirname(dirname(abs_path($mastermdb)));
my $meta = $root . "./meta";
my $datadir = $root . "/dat";

my $umas = decode_json(read_binary('umas.json'));
my $icons = decode_json(read_binary('icons.json'));

# temporary: for importing english names from the old icons file
my $en_icons = decode_json(read_binary('umadle/icons.json'));
my %en_names;
for my $en (keys %$en_icons) {
	my $path = $en_icons->{$en};
	$path =~ /chr_icon_(\d+)\.png/;
	my $id = $1;
	$en_names{$id} = $en;
}

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select_umas = $db->prepare('SELECT [index], text FROM text_data WHERE category = 6 AND [index] < 2000;');
my $select_outfits = $db->prepare('SELECT [index], text FROM text_data WHERE category = 5 AND [index] BETWEEN (?1 * 100) AND ((?1 + 1) * 100) ORDER BY [index] ASC;');

my $metadb = DBI->connect("dbi:SQLite:$meta", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$metadb->{RaiseError} = 1;

my $select_chara_icon = $metadb->prepare('SELECT n, h FROM a WHERE n LIKE ("%/chr_icon_" || ?);');

# for some bizarre reason the icon ids for alts arent always the same as the category 5 ids in text_data (sometimes they are!)
# select all of them and rely on ordering by rowid to sort things out for us.
my $select_trained_icon = $metadb->prepare('SELECT n, h FROM a WHERE n LIKE ("%/trained_chr_icon_" || ?1 || "_" || ?1 || "%") AND n LIKE "%_02" ORDER BY rowid;');

$select_umas->execute;

my ($id, $ja_name);
$select_umas->bind_columns(\($id, $ja_name));

while ($select_umas->fetch) {
	if (!$umas->{$id}) {
		my $icon_path;
		my $icon_hash;
		$select_chara_icon->execute($id);
		$select_chara_icon->bind_columns(\($icon_path, $icon_hash));
		$select_chara_icon->fetch;

		my $en_name = $en_names{$id};
		if (!$en_name) {
			my $haha_perl_windows_unicode_memes_lolxd = Encode::encode('cp932', Encode::decode('utf8', $ja_name));
			print "English name for $haha_perl_windows_unicode_memes_lolxd => ";
			$en_name = <STDIN>;
			chomp $en_name;
		}
		$umas->{$id} = {name => [Encode::decode('utf8', $ja_name), $en_name], outfits => {}};
		my $base = basename($icon_path);  # tehe
		$icons->{$id} = "/uma-tools/icons/chara/$base.png";

		$icon_hash =~ /^(..)/;
		my $hdir = $1;
		copy("$datadir/$hdir/$icon_hash", "need_unpack/$icon_hash");
	}

	my @outfit_ids;
	my $o_id;
	my $epithet;
	$select_outfits->execute($id);
	$select_outfits->bind_columns(\($o_id, $epithet));
	while ($select_outfits->fetch) {
		push @outfit_ids, $o_id;
		$umas->{$id}->{outfits}->{$o_id} = Encode::decode('utf8', $epithet);
	}

	my $icon_path;
	my $icon_hash;
	$select_trained_icon->execute($id);
	$select_trained_icon->bind_columns(\($icon_path, $icon_hash));
	my $i = 0;
	while ($select_trained_icon->fetch) {
		next if $icons->{$outfit_ids[$i++]};
		my $base = basename($icon_path);
		$icons->{$outfit_ids[$i - 1]} = "/uma-tools/icons/chara/$base.png";

		$icon_hash =~ /^(..)/;
		my $hdir = $1;
		copy("$datadir/$hdir/$icon_hash", "need_unpack/$icon_hash");
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
$json->utf8(1);
open(my $umas_fh, '>', 'umas.json');
print $umas_fh $json->encode($umas);
close $umas_fh;
open(my $icons_fh, '>', 'icons.json');
print $icons_fh $json->encode($icons);
close $icons_fh;
